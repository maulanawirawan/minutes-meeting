const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

function generateJitsiToken(options) {
    try {
        const {
            roomName,
            userName,
            userEmail = '',
            userAvatar = '',
            isModerator = false,
            expiresIn = 86400  // 24 hours (was 7200 = 2 hours) - FIX for mobile
        } = options;

        if (!roomName || !userName) {
            throw new Error('roomName and userName are required');
        }

        if (!process.env.JITSI_APP_ID) {
            throw new Error('JITSI_APP_ID not set in .env');
        }

        const privateKeyPath = process.env.JITSI_PRIVATE_KEY_PATH || './ssl-certs/jitsi-private.key';
        
        if (!fs.existsSync(privateKeyPath)) {
            throw new Error(`Private key not found at: ${privateKeyPath}`);
        }
        
        const privateKey = fs.readFileSync(path.resolve(privateKeyPath), 'utf8');
        const now = Math.floor(Date.now() / 1000);
        
        const appId = process.env.JITSI_APP_ID;
        
        // ✅ CRITICAL: JWT structure with LOBBY BYPASS
        const payload = {
            aud: 'jitsi',
            iss: 'chat',
            sub: appId,
            room: roomName,
            exp: now + expiresIn,
            nbf: now - 10,
            iat: now,
            context: {
                user: {
                    id: userName.replace(/\s+/g, '-').toLowerCase(),
                    name: userName,
                    email: userEmail || '',
                    avatar: userAvatar || '',
                    moderator: isModerator ? 'true' : 'false',
                    // ✅ FIX: Add lobby bypass
                    lobby_bypass: true
                },
                features: {
                    livestreaming: isModerator ? 'true' : 'false',
                    recording: isModerator ? 'true' : 'false',
                    transcription: 'true',
                    'outbound-call': 'false'
                }
            }
        };

        // Extract just the key ID suffix from JITSI_KID
        // Example: "vpaas-magic-cookie-xxx/5e9a6e" -> "5e9a6e"
        const kidValue = process.env.JITSI_KID
            ? process.env.JITSI_KID.split('/').pop()  // Get last part after '/'
            : appId;

        const token = jwt.sign(payload, privateKey, {
            algorithm: 'RS256',
            header: {
                kid: kidValue,
                typ: 'JWT',
                alg: 'RS256'
            }
        });

        console.log('✅ JWT Generated:', {
            room: roomName,
            user: userName,
            moderator: isModerator,
            lobbyBypass: true
        });

        return token;
        
    } catch (error) {
        console.error('❌ JWT generation error:', error);
        throw new Error(`Failed to generate JWT: ${error.message}`);
    }
}

function generateMeetingUrl(roomName, userName, options = {}) {
    const token = generateJitsiToken({
        roomName,
        userName,
        ...options
    });

    const appId = process.env.JITSI_APP_ID;
    const tenant = appId.replace('vpaas-magic-cookie-', '');
    
    const baseUrl = `https://8x8.vc/${tenant}/${encodeURIComponent(roomName)}`;
    const fullUrl = `${baseUrl}?jwt=${token}`;

    console.log('🌐 Meeting URL Generated:', {
        tenant,
        room: roomName,
        user: userName,
        moderator: options.isModerator || false
    });

    return {
        url: fullUrl,
        token: token,
        roomName: roomName,
        baseUrl: baseUrl,
        tenant: tenant
    };
}

module.exports = {
    generateJitsiToken,
    generateMeetingUrl
};