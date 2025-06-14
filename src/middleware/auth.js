/**
 * Authentication Middleware for Shortwave Monitor
 * Implements secure authentication with Passport.js and session management
 */

import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import session from 'express-session';

export class AuthenticationManager {
  constructor() {
    this.setupStrategy();
    this.validUsers = new Map(); // In production, use a proper database
    this.initializeUsers();
  }

  async initializeUsers() {
    // Create default users with hashed passwords
    // In production, these should be stored in a secure database
    this.validUsers.set('admin', {
      username: 'admin',
      password: await bcrypt.hash('SecureAdmin123!', 10),
      role: 'admin',
      created: new Date().toISOString()
    });

    this.validUsers.set('monitor', {
      username: 'monitor',
      password: await bcrypt.hash('MonitorPass456!', 10),
      role: 'monitor',
      created: new Date().toISOString()
    });

    console.log('🔐 Authentication system initialized with default users');
    console.log('⚠️  Change default passwords in production!');
  }

  setupStrategy() {
    passport.use(new LocalStrategy(
      {
        usernameField: 'username',
        passwordField: 'password'
      },
      async (username, password, done) => {
        try {
          const user = this.validUsers.get(username);
          
          if (!user) {
            return done(null, false, { 
              message: 'Invalid username or password' 
            });
          }

          const isValid = await bcrypt.compare(password, user.password);
          if (!isValid) {
            return done(null, false, { 
              message: 'Invalid username or password' 
            });
          }

          // Return user without password
          const { password: _, ...userWithoutPassword } = user;
          return done(null, userWithoutPassword);
          
        } catch (error) {
          return done(error);
        }
      }
    ));

    passport.serializeUser((user, done) => {
      done(null, user.username);
    });

    passport.deserializeUser((username, done) => {
      const user = this.validUsers.get(username);
      if (user) {
        const { password: _, ...userWithoutPassword } = user;
        done(null, userWithoutPassword);
      } else {
        done(null, false);
      }
    });
  }

  getSessionMiddleware() {
    return session({
      secret: process.env.SESSION_SECRET || 'change-this-secret-in-production-immediately',
      resave: false,
      saveUninitialized: false,
      name: 'shortwave.sid',
      cookie: { 
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        httpOnly: true, // Prevent XSS
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'strict' // CSRF protection
      },
      rolling: true // Reset expiry on each request
    });
  }

  getPassportMiddleware() {
    return [
      passport.initialize(),
      passport.session()
    ];
  }

  requireAuth(req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(401).json({ 
        error: 'Authentication required',
        loginUrl: '/login'
      });
    }
    
    return res.redirect('/login');
  }

  requireRole(role) {
    return (req, res, next) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ 
          error: 'Authentication required' 
        });
      }
      
      if (req.user.role !== role && req.user.role !== 'admin') {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: role,
          current: req.user.role
        });
      }
      
      next();
    };
  }

  // Method to add new users (for admin interface)
  async addUser(username, password, role = 'monitor') {
    if (this.validUsers.has(username)) {
      throw new Error('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    this.validUsers.set(username, {
      username,
      password: hashedPassword,
      role,
      created: new Date().toISOString()
    });

    return { username, role, created: new Date().toISOString() };
  }

  // Method to change password
  async changePassword(username, oldPassword, newPassword) {
    const user = this.validUsers.get(username);
    if (!user) {
      throw new Error('User not found');
    }

    const isValid = await bcrypt.compare(oldPassword, user.password);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.lastPasswordChange = new Date().toISOString();

    return { message: 'Password changed successfully' };
  }

  // Get user list (without passwords)
  getUsers() {
    const users = [];
    for (const [username, user] of this.validUsers.entries()) {
      const { password: _, ...userWithoutPassword } = user;
      users.push(userWithoutPassword);
    }
    return users;
  }
}

export default AuthenticationManager;