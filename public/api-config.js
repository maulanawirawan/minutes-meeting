// public/api-config.js
(function() {
    const API_PORT = window.location.protocol === 'https:' ? 8443 : 8000;
    const POSSIBLE_HOSTS = [
        window.location.hostname,
        '192.168.1.20',
        'localhost',
        '127.0.0.1'
    ];
    
    async function testApiConnection(baseUrl) {
        try {
            const response = await fetch(`${baseUrl}/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(3000)
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }
    
    async function findWorkingApiUrl() {
        console.log('🔍 Searching for working API URL...');
        
        for (let hostname of POSSIBLE_HOSTS) {
            const testUrl = `${window.location.protocol}//${hostname}:${API_PORT}`;
            console.log(`   Testing: ${testUrl}`);
            
            const isWorking = await testApiConnection(testUrl);
            
            if (isWorking) {
                console.log(`   ✅ Found: ${testUrl}`);
                return { url: testUrl, hostname: hostname };
            }
        }
        
        return null;
    }
    
    async function initializeApiUrl() {
        const currentHost = window.location.hostname;
        const currentUrl = `${window.location.protocol}//${currentHost}:${API_PORT}`;
        
        const isCurrentWorking = await testApiConnection(currentUrl);
        
        if (isCurrentWorking) {
            console.log('✅ API OK:', currentUrl);
            window.API_URL = currentUrl;
            return currentUrl;
        }
        
        console.warn('⚠️ Searching alternatives...');
        const working = await findWorkingApiUrl();
        
        if (working) {
            window.API_URL = working.url;
            
            if (currentHost !== working.hostname) {
                const newUrl = `${window.location.protocol}//${working.hostname}:${API_PORT}${window.location.pathname}`;
                alert(`Redirecting to:\n${newUrl}`);
                setTimeout(() => { window.location.href = newUrl; }, 1000);
                return null;
            }
            
            return working.url;
        }
        
        alert('❌ Cannot connect to server!');
        window.API_URL = currentUrl;
        return currentUrl;
    }
    
    window.API_URL = `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;
    window.API_READY = initializeApiUrl();
})();