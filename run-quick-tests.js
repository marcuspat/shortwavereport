#!/usr/bin/env node
/**
 * Quick Test Runner
 * Runs essential tests quickly for development
 */

import { spawn } from 'child_process';
import path from 'path';

const testFiles = [
  'test/resilience-integration.test.js',
  'test/ai-service.test.js'
];

console.log('🚀 Running Quick Tests...');
console.log('━'.repeat(50));

async function runTest(testFile) {
  return new Promise((resolve, reject) => {
    const filePath = path.resolve(testFile);
    const process = spawn('node', ['--test', filePath], {
      stdio: 'pipe',
      cwd: path.dirname(filePath)
    });

    let output = '';
    let errors = '';

    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.stderr.on('data', (data) => {
      errors += data.toString();
    });

    process.on('close', (code) => {
      resolve({
        file: testFile,
        code,
        output,
        errors,
        success: code === 0
      });
    });

    process.on('error', (error) => {
      reject({
        file: testFile,
        error: error.message
      });
    });
  });
}

async function runAllTests() {
  const results = [];
  
  for (const testFile of testFiles) {
    console.log(`📝 Testing: ${testFile}`);
    
    try {
      const result = await runTest(testFile);
      results.push(result);
      
      if (result.success) {
        console.log(`✅ ${testFile} - PASSED`);
      } else {
        console.log(`❌ ${testFile} - FAILED`);
        console.log(result.errors);
      }
    } catch (error) {
      console.log(`💥 ${testFile} - ERROR: ${error.error}`);
      results.push({
        file: testFile,
        success: false,
        error: error.error
      });
    }
  }

  // Summary
  console.log('\n📊 Test Summary');
  console.log('━'.repeat(30));
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${results.length}`);
  
  if (failed > 0) {
    console.log('\n🔍 Failed Tests:');
    results.filter(r => !r.success).forEach(result => {
      console.log(`   • ${result.file}`);
    });
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

runAllTests().catch(console.error);