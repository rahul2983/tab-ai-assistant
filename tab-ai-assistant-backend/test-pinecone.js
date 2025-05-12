// test-pinecone.js
// Updated for latest Pinecone SDK
require('dotenv').config();
const { Pinecone } = require('@pinecone-database/pinecone');
const https = require('https');

// Log environment info
console.log('Testing Pinecone connection with the following configuration:');
console.log(`API Key: ${process.env.PINECONE_API_KEY ? '✓ Set (first 4 chars: ' + process.env.PINECONE_API_KEY.substring(0, 4) + '...)' : '✗ Not set'}`);
console.log(`Index: ${process.env.PINECONE_INDEX || 'Not set'}`);

// Test direct HTTP connection to Pinecone API
console.log('\n1. Testing direct HTTP connection to Pinecone API...');
const testApiConnection = () => {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.pinecone.io',
      port: 443,
      path: '/indexes',
      method: 'GET',
      headers: {
        'Api-Key': process.env.PINECONE_API_KEY
      },
      timeout: 5000
    };

    const req = https.request(options, (res) => {
      console.log(`  Status Code: ${res.statusCode}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`  Response: ${data.length > 100 ? data.substring(0, 100) + '...' : data}`);
        resolve(true);
      });
    });
    
    req.on('error', (e) => {
      console.error(`  Error: ${e.message}`);
      if (e.code === 'ECONNRESET') {
        console.log('  → Connection was reset. This could indicate network issues or firewall restrictions.');
      }
      resolve(false);
    });
    
    req.on('timeout', () => {
      console.log('  → Request timed out');
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
};

// Test connection using the Pinecone client
console.log('\n2. Testing connection using Pinecone client...');
const testPineconeClient = async () => {
  try {
    console.log('  Initializing Pinecone client...');
    
    // Get SDK version to determine initialization format
    const sdkVersion = require('@pinecone-database/pinecone/package.json').version;
    console.log(`  Detected Pinecone SDK v${sdkVersion}`);
    
    // Initialize with the correct format based on SDK version
    let pinecone;
    if (sdkVersion.startsWith('1.')) {
      // Old SDK format
      pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
        environment: process.env.PINECONE_ENVIRONMENT || 'us-east-1-aws'
      });
    } else {
      // New SDK format
      pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY
      });
    }
    
    console.log('  Listing indexes...');
    const indexes = await pinecone.listIndexes();
    console.log(`  Available indexes: ${JSON.stringify(indexes)}`);
    
    if (process.env.PINECONE_INDEX) {
      console.log(`  Connecting to index: ${process.env.PINECONE_INDEX}`);
      const index = pinecone.index(process.env.PINECONE_INDEX);
      
      console.log('  Getting index stats...');
      const stats = await index.describeIndexStats();
      console.log(`  Index stats: ${JSON.stringify(stats)}`);
    }
    
    return true;
  } catch (error) {
    console.error(`  Error: ${error.message}`);
    console.error(`  Stack: ${error.stack}`);
    return false;
  }
};

// Test direct connection to the index host
console.log('\n3. Testing direct connection to index host...');
const testDirectIndexConnection = () => {
  return new Promise((resolve) => {
    const host = `${process.env.PINECONE_INDEX}-5yrh4et.svc.aped-4627-b74a.pinecone.io`;
    console.log(`  Attempting to connect to: ${host}`);
    
    const options = {
      hostname: host,
      port: 443,
      path: '/describe_index_stats',
      method: 'GET',
      headers: {
        'Api-Key': process.env.PINECONE_API_KEY
      },
      timeout: 5000
    };

    const req = https.request(options, (res) => {
      console.log(`  Status Code: ${res.statusCode}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`  Response: ${data.length > 100 ? data.substring(0, 100) + '...' : data}`);
        resolve(true);
      });
    });
    
    req.on('error', (e) => {
      console.error(`  Error: ${e.message}`);
      if (e.code === 'ECONNRESET') {
        console.log('  → Connection was reset. This could indicate network issues or firewall restrictions.');
      }
      resolve(false);
    });
    
    req.on('timeout', () => {
      console.log('  → Request timed out');
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
};

// Run tests
(async () => {
  console.log('=== PINECONE CONNECTION TEST ===');
  
  const apiConnectionOk = await testApiConnection();
  console.log(`\nAPI Connection: ${apiConnectionOk ? '✅ Success' : '❌ Failed'}`);
  
  const clientConnectionOk = await testPineconeClient();
  console.log(`\nClient Connection: ${clientConnectionOk ? '✅ Success' : '❌ Failed'}`);
  
  const directConnectionOk = await testDirectIndexConnection();
  console.log(`\nDirect Connection: ${directConnectionOk ? '✅ Success' : '❌ Failed'}`);
  
  console.log('\n=== RECOMMENDATIONS ===');
  if (!apiConnectionOk && !clientConnectionOk && !directConnectionOk) {
    console.log('❌ All connection methods failed. This suggests:');
    console.log('  1. Your network may be blocking connections to Pinecone');
    console.log('  2. Your API key may be invalid');
    console.log('  3. There might be a Pinecone service outage');
    console.log('\nTry:');
    console.log('  - Connecting from a different network (e.g., mobile hotspot)');
    console.log('  - Checking the Pinecone status page: https://status.pinecone.io/');
    console.log('  - Verifying your API key in the Pinecone console');
  } else if (!clientConnectionOk && (apiConnectionOk || directConnectionOk)) {
    console.log('⚠️ The Pinecone client is having issues, but direct connections work.');
    console.log('This suggests a problem with the SDK configuration or compatibility.');
    console.log('\nTry:');
    console.log('  - Using the correct SDK initialization for your version');
    console.log('  - Using a different connection approach (direct HTTP requests)');
  } else if (apiConnectionOk && !directConnectionOk) {
    console.log('⚠️ The Pinecone API is accessible but your specific index is not.');
    console.log('This suggests your index might be in a different region or incorrectly configured.');
    console.log('\nTry:');
    console.log('  - Verifying your index name and host in the Pinecone console');
    console.log('  - Checking if your index is in a different environment/region');
  }
  
  console.log('\n=== TEST COMPLETE ===');
})();