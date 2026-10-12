const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function runAuthAndQuotaTests() {
    console.log('=== STARTING AUTOMATED AUTH & QUOTA VERIFICATION TEST ===');
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.goto('http://localhost:4000', { waitUntil: 'networkidle2' });
        console.log('[PASS] Navigated to http://localhost:4000');

        // 1. Check initial quota text
        const initialQuota = await page.$eval('#attempts-count-text', el => el.textContent.trim());
        console.log(`[CHECK 1] Initial scan quota text: "${initialQuota}"`);
        if (!initialQuota.includes('5 / 5 Free Scans')) {
            throw new Error(`Expected '5 / 5 Free Scans', got: ${initialQuota}`);
        }
        console.log('[PASS 1] Initial quota shows 5 / 5 Free Scans');

        // 2. Open login modal
        await page.click('#btn-open-login');
        await page.waitForSelector('#modal-login', { visible: true });
        const isModalVisible = await page.$eval('#modal-login', el => el.style.display !== 'none');
        if (!isModalVisible) throw new Error('Modal login is not visible after clicking Sign In button');
        console.log('[PASS 2] Login modal opened via #btn-open-login');

        // Verify limit alert is hidden initially
        const isAlertHidden = await page.$eval('#login-limit-alert', el => el.style.display === 'none');
        if (!isAlertHidden) throw new Error('Login limit alert should be hidden when opening normally');
        console.log('[PASS 3] Limit alert is hidden on normal open');

        // 3. Close modal
        await page.click('#btn-close-login');
        await page.waitForFunction(() => document.getElementById('modal-login').style.display === 'none');
        console.log('[PASS 4] Modal closed successfully via #btn-close-login');

        // 4. Reopen modal and test mode switch
        await page.click('#btn-open-login');
        await page.waitForSelector('#modal-login', { visible: true });
        await page.click('#btn-switch-auth-mode');
        const titleText = await page.$eval('#login-title-text', el => el.textContent.trim());
        const isNameGroupVisible = await page.$eval('#form-group-name', el => el.style.display !== 'none');
        if (!titleText.includes('Create Account') || !isNameGroupVisible) {
            throw new Error('Switching to Create Account mode failed');
        }
        console.log('[PASS 5] Switched to Create Account mode (Full name field displayed)');

        // 5. Test Live Password Policy Checklist
        await page.type('#auth-input-password', 'short1');
        const ruleLengthValid = await page.$eval('#rule-length', el => el.classList.contains('valid'));
        if (ruleLengthValid) throw new Error('rule-length should be invalid for "short1"');
        console.log('[PASS 6] Rule length (<12) correctly marked invalid for short password');

        // Switch back to Sign In mode
        await page.click('#btn-switch-auth-mode');

        // 6. Test Demo Fill button
        await page.click('#btn-demo-fill');
        const filledEmail = await page.$eval('#auth-input-email', el => el.value);
        const filledPassword = await page.$eval('#auth-input-password', el => el.value);
        const allRulesValid = await page.$$eval('.policy-rule.valid', els => els.length);
        const strengthText = await page.$eval('#strength-status-text', el => el.textContent.trim());

        if (filledEmail !== 'demo.user@precheck.io' || !filledPassword.includes('SecurePass')) {
            throw new Error('Demo credentials fill failed');
        }
        if (allRulesValid !== 5) {
            throw new Error(`Expected all 5 password rules to be valid, found: ${allRulesValid}`);
        }
        if (!strengthText.includes('Excellent')) {
            throw new Error(`Expected Excellent strength, got: ${strengthText}`);
        }
        console.log(`[PASS 7] Demo credentials filled successfully (${allRulesValid}/5 rules valid, ${strengthText})`);

        // 7. Submit Login Form
        await page.click('#btn-auth-submit');
        await page.waitForFunction(() => document.getElementById('modal-login').style.display === 'none');
        console.log('[PASS 8] Login form submitted and modal closed');

        // 8. Verify Signed-In Unlimited State
        const signedInQuota = await page.$eval('#attempts-count-text', el => el.textContent.trim());
        const userEmail = await page.$eval('#nav-user-email', el => el.textContent.trim());
        const isProfileVisible = await page.$eval('#user-profile-badge', el => el.style.display !== 'none');
        const isLoginBtnHidden = await page.$eval('#btn-open-login', el => el.style.display === 'none');

        console.log(`[CHECK 8] Signed in quota: "${signedInQuota}", User email: "${userEmail}"`);
        if (!signedInQuota.includes('Unlimited')) throw new Error('Quota did not update to Unlimited');
        if (userEmail !== 'demo.user@precheck.io') throw new Error('User email not set in navigation');
        if (!isProfileVisible || !isLoginBtnHidden) throw new Error('Profile badge or login button display incorrect');
        console.log('[PASS 9] User navigation profile and Unlimited scans indicator active');

        // 9. Test Logout
        await page.click('#btn-nav-logout');
        const loggedOutQuota = await page.$eval('#attempts-count-text', el => el.textContent.trim());
        const isLoginBtnBack = await page.$eval('#btn-open-login', el => el.style.display !== 'none');
        if (!loggedOutQuota.includes('Free Scans') || !isLoginBtnBack) {
            throw new Error('Logout failed to reset quota UI');
        }
        console.log('[PASS 10] Logout successfully reverted to guest quota');

        // 10. Test Quota Exhaustion Gating
        // Set scan count to 5 in localStorage
        await page.evaluate(() => {
            localStorage.setItem('precheck_scan_count', '5');
            // Trigger UI refresh
            window.location.reload();
        });
        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        const exhaustedQuota = await page.$eval('#attempts-count-text', el => el.textContent.trim());
        console.log(`[CHECK 11] Exhausted quota text: "${exhaustedQuota}"`);
        if (!exhaustedQuota.includes('0 / 5 Free Scans')) {
            throw new Error(`Expected '0 / 5 Free Scans', got: ${exhaustedQuota}`);
        }

        // Try to initiate scan with target URL
        await page.type('#target-url-input', 'http://example.com');
        await page.click('#btn-inspect');

        // Check if modal popped up automatically with limit alert visible
        await page.waitForFunction(() => document.getElementById('modal-login').style.display === 'flex');
        const isLimitAlertShown = await page.$eval('#login-limit-alert', el => el.style.display !== 'none');
        if (!isLimitAlertShown) {
            throw new Error('Login limit alert was not shown when scan limit was reached');
        }
        console.log('[PASS 11] Gating active: Scan blocked when quota is 0, login modal auto-opened with limit alert!');

        // 11. Test Google Sign In from limit modal
        await page.click('#btn-google-auth');
        await page.waitForFunction(() => document.getElementById('modal-login').style.display === 'none');
        const googleQuota = await page.$eval('#attempts-count-text', el => el.textContent.trim());
        if (!googleQuota.includes('Unlimited')) {
            throw new Error('Google sign in did not unlock unlimited scans');
        }
        console.log('[PASS 12] Google Sign In successfully unlocked unlimited scans from limit alert');

        console.log('\n=================================================');
        console.log('ALL 12 AUTH & SCAN QUOTA TESTS PASSED PERFECTLY!');
        console.log('=================================================');
    } finally {
        await browser.close();
    }
}

runAuthAndQuotaTests().catch(err => {
    console.error('TEST FAILED:', err);
    process.exit(1);
});
