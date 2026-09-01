import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const apiKey = process.env.BINANCE_API_KEY;
const apiSecret = process.env.BINANCE_API_SECRET;

console.log('=== Binance Auth Debug ===');
console.log('API Key:', apiKey?.substring(0, 12) + '...');
console.log('');

// Get server time first
const serverTime = (await axios.get('https://api.binance.com/api/v3/time')).data.serverTime;
const localTime = Date.now();
console.log('Binance Server time:', serverTime);
console.log('Your Local time:', localTime);
console.log('Time difference:', localTime - serverTime, 'ms (should be < 5000)');
console.log('');

// Test with server time
const timestamp = serverTime;
const queryString = `timestamp=${timestamp}`;
const signature = crypto.createHmac('sha256', apiSecret).update(queryString).digest('hex');

console.log('Testing /api/v3/account endpoint...');
try {
  const resp = await axios.get(
    `https://api.binance.com/api/v3/account?${queryString}&signature=${signature}`,
    { headers: { 'X-MBX-APIKEY': apiKey } }
  );
  console.log('');
  console.log('✓ SUCCESS! API key is valid.');
  console.log('Can Trade:', resp.data.canTrade);
  console.log('Permissions:', resp.data.permissions);

  const usdt = resp.data.balances.find(b => b.asset === 'USDT');
  console.log('USDT Balance:', usdt?.free || '0');
} catch (e) {
  console.log('');
  console.log('✗ FAILED');
  console.log('Error code:', e.response?.data?.code);
  console.log('Error msg:', e.response?.data?.msg);
  console.log('');

  if (e.response?.data?.code === -2015) {
    console.log('=== DIAGNOSIS ===');
    console.log('Error -2015 means one of:');
    console.log('1. API key deleted or invalid');
    console.log('2. Your IP is NOT in the whitelist (most common!)');
    console.log('3. API key lacks "Enable Spot & Margin Trading" permission');
    console.log('');
    console.log('ACTION REQUIRED:');
    console.log('1. Go to https://www.binance.com/en/my/settings/api-management');
    console.log('2. Find your API key: ' + apiKey?.substring(0, 12) + '...');
    console.log('3. Click "Edit" and check:');
    console.log('   - "Enable Spot & Margin Trading" is ON');
    console.log('   - Your current IP is in the whitelist OR "Unrestricted" is selected');
  }
}
