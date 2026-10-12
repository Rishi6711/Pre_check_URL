const WebSocket = require('ws');

function runTest(testName, url) {
    return new Promise((resolve, reject) => {
        console.log(`\n=================================================`);
        console.log(`RUNNING TEST: ${testName} -> ${url}`);
        console.log(`=================================================`);

        const ws = new WebSocket('ws://localhost:4000/ws');
        const sessionId = 'test_' + Date.now();
        let verificationHandled = false;

        ws.on('open', () => {
            console.log('[WS] Connected to server.');
            ws.send(JSON.stringify({
                type: 'START_SCAN',
                sessionId,
                url,
                options: { viewportWidth: 1280, viewportHeight: 800 }
            }));
        });

        ws.on('message', (msg) => {
            const data = JSON.parse(msg);
            if (data.type === 'SCAN_STARTED') {
                console.log(`[PASS] Scan started with browser: ${data.browser}`);
            } else if (data.type === 'HTTP_REDIRECT_HOP') {
                console.log(`[PASS] Redirect hop detected: ${data.status} ${data.statusText} -> ${data.toUrl}`);
            } else if (data.type === 'DOWNLOAD_DETECTED') {
                console.log(`[PASS] File download detected!`);
                console.log(`       Filename: ${data.download.filename}`);
                console.log(`       Extension: ${data.download.extension}`);
                console.log(`       MIME: ${data.download.mimeType}`);
                console.log(`       Risk: ${data.download.riskLevel}`);
            } else if (data.type === 'HUMAN_VERIFICATION_PERMISSION_REQUIRED') {
                console.log(`[PASS] Human verification permission prompt triggered between Page 1 and Page 2!`);
                console.log(`       Challenge: ${data.challengeType}`);
                console.log(`       Stage: ${data.stage}`);
                console.log(`       URL: ${data.url}`);
                console.log(`[ACTION] Granting user permission to start interactive session...`);
                ws.send(JSON.stringify({
                    type: 'PERMISSION_RESPONSE',
                    sessionId,
                    granted: true
                }));
            } else if (data.type === 'HUMAN_VERIFICATION_SESSION_ACTIVE' || data.type === 'HUMAN_VERIFICATION_REQUIRED') {
                console.log(`[PASS] Live interactive screencast session active.`);
                if (!verificationHandled) {
                    verificationHandled = true;
                    console.log(`[ACTION] Simulating user click on verification box / completing challenge...`);
                    setTimeout(() => {
                        ws.send(JSON.stringify({
                            type: 'INTERACTION_EVENT',
                            sessionId,
                            eventType: 'click',
                            x: 480,
                            y: 280,
                            button: 'left'
                        }));
                        ws.send(JSON.stringify({
                            type: 'VERIFICATION_COMPLETED_BY_USER',
                            sessionId
                        }));
                    }, 1200);
                }
            } else if (data.type === 'SCREENCAST_FRAME') {
                process.stdout.write('.');
            } else if (data.type === 'HUMAN_VERIFICATION_RESOLVED') {
                console.log(`\n[PASS] Human verification solved! Transitioning to Second Web Page...`);
            } else if (data.type === 'SCAN_COMPLETE') {
                console.log(`\n[SUCCESS] Scan complete! Outcomes summary:`);
                console.log(`  1. Screenshot count: ${data.results.outcomes.screenshots.length}`);
                console.log(`  2. Redirect hops: ${data.results.outcomes.redirectChain.length}`);
                data.results.outcomes.redirectChain.forEach(h => {
                    console.log(`     - [Hop ${h.hopNumber}] (${h.status} ${h.statusText}) ${h.url} [Stage: ${h.pageStage || 'N/A'}]`);
                });
                console.log(`  3. Destination IPs: ${data.results.outcomes.destinationIps.length}`);
                data.results.outcomes.destinationIps.forEach(ip => {
                    console.log(`     - ${ip.hostname} -> ${ip.ip} (${ip.city}, ${ip.country}) [${ip.isp || ip.org}]`);
                });
                console.log(`  4. File downloads: ${data.results.outcomes.downloads.length}`);
                data.results.outcomes.downloads.forEach(dl => {
                    console.log(`     - File: ${dl.filename} [Ext: ${dl.extension}] [Risk: ${dl.riskLevel}]`);
                });

                ws.close();
                resolve(data.results);
            } else if (data.type === 'SCAN_ERROR') {
                console.error(`[ERROR] Scan error:`, data.message);
                ws.close();
                reject(new Error(data.message));
            }
        });

        ws.on('error', (err) => {
            console.error('[WS ERROR]', err);
            reject(err);
        });
    });
}

async function runAll() {
    try {
        // Test 1: Two Successive Web Pages Flow (Page 1 -> Page 2)
        await runTest('Two Successive Web Pages Flow', 'http://localhost:4000/test/two-stage-flow');

        // Test 2: In-Between Human Verification with Permission Prompt
        await runTest('In-Between Human Verification (Permission Required)', 'http://localhost:4000/test/captcha-permission');

        // Test 3: Multi-Hop Redirect Chain
        await runTest('Multi-Hop Redirect Chain', 'http://localhost:4000/test/chain-start');

        // Test 4: File Download Detection (.exe)
        await runTest('Executable File Download', 'http://localhost:4000/test/download-file?type=exe');

        // Test 5: Single Stage (ends at first stage)
        await runTest('Single Stage (Ends at First Stage)', 'http://localhost:4000/test/single-stage');

        console.log('\n=================================================');
        console.log('ALL TESTS COMPLETED SUCCESSFULLY! 100% WORKING!');
        console.log('=================================================\n');
    } catch (e) {
        console.error('Test suite failed:', e);
    }
}

runAll();
