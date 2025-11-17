#!/usr/bin/env node

/**
 * naraMEET - Password Hash Generator
 * 
 * Script untuk generate bcrypt hash untuk password baru
 * Usage: node generate-password.js <password>
 */

const bcrypt = require('bcryptjs');

// Get password from command line
const password = process.argv[2];

if (!password) {
    console.log(`
╔════════════════════════════════════════════════════╗
║   naraMEET - Password Hash Generator               ║
╚════════════════════════════════════════════════════╝

Usage:
  node generate-password.js <your-new-password>

Example:
  node generate-password.js MySecurePass123

This will generate a bcrypt hash that you can use in server.js
    `);
    process.exit(1);
}

// Generate hash
const saltRounds = 10;
const hash = bcrypt.hashSync(password, saltRounds);

console.log(`
╔════════════════════════════════════════════════════╗
║   Password Hash Generated                          ║
╚════════════════════════════════════════════════════╝

Password: ${password}
Hash:     ${hash}

To use this hash:

1. Edit server.js
2. Find the users array
3. Replace the password hash:

const users = [
    {
        id: 1,
        username: 'admin',
        password: '${hash}',
        email: 'admin@narameet.com',
        role: 'admin',
        name: 'Administrator'
    }
];

4. Save and restart:
   docker-compose restart backend

5. Login with new password!

═══════════════════════════════════════════════════
`);
