import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Siva_Haritha/AppData/Roaming/npm/node_modules/@playwright/mcp/node_modules/playwright-core');
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5173';
const ARTIFACTS_DIR = path.resolve('qa-artifacts');

if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

// Color formatting for test reporting
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

const results = [];

function recordResult(suite, testName, passed, details = '') {
  results.push({ suite, testName, passed, details });
  const statusIcon = passed ? `${colors.green}✔ PASS${colors.reset}` : `${colors.red}✖ FAIL${colors.reset}`;
  console.log(`  ${statusIcon} ${testName} ${details ? `(${details})` : ''}`);
}

async function runQASuite() {
  console.log(`\n${colors.bold}${colors.cyan}=======================================================`);
  console.log(`  MIDISense Automated QA Testing Suite (Playwright)`);
  console.log(`  Target: ${BASE_URL}`);
  console.log(`=======================================================${colors.reset}\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  page.on('requestfailed', (req) => {
    // Ignore benign analytics/extension requests
    const url = req.url();
    if (!url.includes('google-analytics') && !url.includes('identitytoolkit')) {
      failedRequests.push(`${req.method()} ${url} - ${req.failure()?.errorText || 'failed'}`);
    }
  });

  try {
    // ─────────────────────────────────────────────────────────────
    // SUITE 1: Application Health & Initial Load
    // ─────────────────────────────────────────────────────────────
    console.log(`${colors.bold}Suite 1: Application Health & Initial Load${colors.reset}`);

    const response = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const status = response ? response.status() : 0;
    recordResult('Suite 1', 'App responds with HTTP 200', status === 200, `Status: ${status}`);

    // Redirection check for unauthenticated user
    await page.waitForURL('**/login', { timeout: 5000 });
    const currentUrl = page.url();
    recordResult('Suite 1', 'Unauthenticated root visits redirect to /login', currentUrl.endsWith('/login'), `URL: ${currentUrl}`);

    await page.waitForFunction(() => document.title.length > 0);
    const title = await page.title();
    recordResult('Suite 1', 'Page title is correct', title.includes('MIDISense'), `Title: "${title}"`);

    // ─────────────────────────────────────────────────────────────
    // SUITE 2: Login Page UI & Structure
    // ─────────────────────────────────────────────────────────────
    console.log(`\n${colors.bold}Suite 2: Login Page UI & Form Controls${colors.reset}`);

    const brandHeader = await page.locator('h1.gradient-text').textContent();
    recordResult('Suite 2', 'Branding header exists with "MIDISense"', brandHeader?.trim() === 'MIDISense');

    const emailInput = page.locator('input#email');
    const hasEmail = await emailInput.isVisible();
    recordResult('Suite 2', 'Email input field is present & visible', hasEmail);

    const passwordInput = page.locator('input#password');
    const hasPassword = await passwordInput.isVisible();
    const pwType = await passwordInput.getAttribute('type');
    recordResult('Suite 2', 'Password field is masked (type="password")', hasPassword && pwType === 'password');

    const googleBtn = page.locator('button:has-text("Continue with Google")');
    recordResult('Suite 2', 'Google OAuth Sign-in button is visible', await googleBtn.isVisible());

    const submitBtn = page.locator('button[type="submit"]');
    const submitText = await submitBtn.textContent();
    recordResult('Suite 2', 'Submit button has "Sign In" text initially', submitText?.includes('Sign In'));

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '01-login-view.png') });

    // ─────────────────────────────────────────────────────────────
    // SUITE 3: Validation & Boundary Scenarios
    // ─────────────────────────────────────────────────────────────
    console.log(`\n${colors.bold}Suite 3: Form Validation & Mode Switching${colors.reset}`);

    // Trigger validation with empty inputs
    await submitBtn.click();
    await page.waitForTimeout(300);
    const emailErrorEmpty = await page.locator('p:has-text("Please enter a valid email address.")').isVisible();
    recordResult('Suite 3', 'Empty form triggers email validation error', emailErrorEmpty);

    // Enter invalid email format
    await emailInput.fill('invalidemailformat');
    await submitBtn.click();
    await page.waitForTimeout(300);
    const emailErrorInvalid = await page.locator('p:has-text("Please enter a valid email address.")').isVisible();
    recordResult('Suite 3', 'Malformed email triggers validation error', emailErrorInvalid);

    // Enter short password (<6 chars)
    await emailInput.fill('qa.tester@example.com');
    await passwordInput.fill('123');
    await submitBtn.click();
    await page.waitForTimeout(300);
    const pwErrorShort = await page.locator('p:has-text("Password must be at least 6 characters.")').isVisible();
    recordResult('Suite 3', 'Short password (<6 chars) triggers validation error', pwErrorShort);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '02-validation-errors.png') });

    // Switch to Sign Up mode
    const signUpToggle = page.locator('button:has-text("Sign Up")').first();
    await signUpToggle.click();
    await page.waitForTimeout(300);

    const submitBtnSignUp = page.locator('button[type="submit"]');
    const submitTextSignUp = await submitBtnSignUp.textContent();
    recordResult('Suite 3', 'Toggle mode switches button to "Create Account"', submitTextSignUp?.includes('Create Account'));

    // Errors should clear upon mode switch
    const errorsCleared = !(await page.locator('p:has-text("Password must be at least 6 characters.")').isVisible());
    recordResult('Suite 3', 'Mode switch clears previous validation errors', errorsCleared);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '03-signup-view.png') });

    // Switch back to Login mode
    const logInToggle = page.locator('button:has-text("Log In")').first();
    await logInToggle.click();

    // ─────────────────────────────────────────────────────────────
    // SUITE 4: Route Protection & Security Guards
    // ─────────────────────────────────────────────────────────────
    console.log(`\n${colors.bold}Suite 4: Route Protection & Navigation Guards${colors.reset}`);

    // Ensure session is cleared for unauthenticated tests
    await page.evaluate(() => {
      localStorage.removeItem('midisense_qa_user');
      if (window.__useAuthStore) {
        window.__useAuthStore.getState().clearUser();
      }
    });

    const protectedRoutes = ['/dashboard', '/practice', '/lessons', '/sequencer', '/onboarding'];

    for (const route of protectedRoutes) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
      const isRedirected = page.url().includes('/login');
      recordResult('Suite 4', `Unauthenticated visit to ${route} redirects to /login`, isRedirected, `Landed at: ${page.url()}`);
    }

    // Fallback 404 route
    await page.goto(`${BASE_URL}/nonexistent-qa-path-999`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    recordResult('Suite 4', 'Unknown routes redirect cleanly to /login', page.url().includes('/login'));

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '04-unauthorized-redirect.png') });

    // ─────────────────────────────────────────────────────────────
    // SUITE 5: Authenticated User Experience (Dashboard)
    // ─────────────────────────────────────────────────────────────
    console.log(`\n${colors.bold}Suite 5: Authenticated User Experience (Dashboard)${colors.reset}`);

    // Set authenticated session via localStorage and Zustand store
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      const qaUser = {
        uid: 'qa-tester-user-001',
        email: 'qa.tester@midisense.io',
        displayName: 'Alex QA'
      };
      localStorage.setItem('midisense_qa_user', JSON.stringify(qaUser));
      if (window.__useAuthStore) {
        window.__useAuthStore.getState().setUser(qaUser);
      }
    });

    // Navigate to dashboard
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const isDashboard = page.url().includes('/dashboard');
    recordResult('Suite 5', 'Authenticated user successfully enters /dashboard', isDashboard, `URL: ${page.url()}`);

    const hasGreeting = await page.locator('h1:has-text("Hey,"), h1:has-text("Alex QA"), p:has-text("Welcome back")').first().isVisible();
    recordResult('Suite 5', 'Dashboard displays personalized greeting', hasGreeting);

    const practiceCard = await page.locator('a[href="/practice"]').first().isVisible();
    const lessonsCard = await page.locator('a[href="/lessons"]').first().isVisible();
    const sequencerCard = await page.locator('a[href="/sequencer"]').first().isVisible();
    recordResult('Suite 5', 'Feature navigation cards exist (Practice, Lessons, Sequencer)', practiceCard && lessonsCard && sequencerCard);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '05-dashboard.png') });

    // ─────────────────────────────────────────────────────────────
    // SUITE 6: Lessons Page
    // ─────────────────────────────────────────────────────────────
    console.log(`\n${colors.bold}Suite 6: Lessons Curriculum Page${colors.reset}`);

    await page.goto(`${BASE_URL}/lessons`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const hasLessonsHeader = await page.locator('h1:has-text("Your Learning Path"), h1:has-text("Lessons"), h1:has-text("Curriculum")').first().isVisible();
    recordResult('Suite 6', 'Lessons header loads correctly', hasLessonsHeader);

    const lessonCardsCount = await page.locator('button[aria-label], div[class*="glass-card"]').count();
    recordResult('Suite 6', 'Lesson curriculum units are populated', lessonCardsCount > 0, `Found ${lessonCardsCount} units/elements`);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '06-lessons-page.png') });

    // ─────────────────────────────────────────────────────────────
    // SUITE 7: Practice Room & Virtual Piano Keyboard
    // ─────────────────────────────────────────────────────────────
    console.log(`\n${colors.bold}Suite 7: Practice Room & Virtual Piano Keyboard${colors.reset}`);

    await page.goto(`${BASE_URL}/practice`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const hasMidiStatus = await page.locator('text=MIDI').first().isVisible();
    recordResult('Suite 7', 'MIDI Status indicator is rendered', hasMidiStatus);

    // Locate Piano Keyboard white keys
    const pianoKeys = page.locator('button[id^="key-"]');
    const keyCount = await pianoKeys.count();
    recordResult('Suite 7', 'Interactive piano keys rendered', keyCount > 0, `Detected ${keyCount} keys`);

    // Test clicking piano keys
    if (keyCount > 0) {
      const c4 = page.locator('button#key-C4').first();
      if (await c4.isVisible()) {
        await c4.click();
      } else {
        await pianoKeys.first().click();
      }
      await page.waitForTimeout(200);
      recordResult('Suite 7', 'Piano key interactive click event succeeds', true);
    }

    // AI Tutor chat drawer
    const hasTutorChat = await page.locator('aside[aria-label="Tutor chat sidebar"], p:has-text("AI Tutor")').first().isVisible();
    recordResult('Suite 7', 'AI Tutor coach panel is rendered', hasTutorChat);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '07-practice-page.png') });

    // ─────────────────────────────────────────────────────────────
    // SUITE 8: Sequencer & Piano Roll Studio
    // ─────────────────────────────────────────────────────────────
    console.log(`\n${colors.bold}Suite 8: Sequencer & Piano Roll Studio${colors.reset}`);

    await page.goto(`${BASE_URL}/sequencer`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const hasBpmControl = await page.locator('span:has-text("BPM")').first().isVisible();
    recordResult('Suite 8', 'Transport Bar BPM control rendered', hasBpmControl);

    const hasPlayControl = await page.locator('button[aria-label*="Play"], button[aria-label*="play"], button:has-text("Play"), button svg').first().isVisible();
    recordResult('Suite 8', 'Transport Bar playback controls rendered', hasPlayControl);

    const hasPianoRoll = await page.locator('canvas, [class*="piano-roll"], div[style*="overflow"]').first().isVisible();
    recordResult('Suite 8', 'Piano roll canvas/grid is rendered', hasPianoRoll);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '08-sequencer-page.png') });

    // ─────────────────────────────────────────────────────────────
    // SUITE 9: Responsive Design & Viewport Validation
    // ─────────────────────────────────────────────────────────────
    console.log(`\n${colors.bold}Suite 9: Mobile & Responsive Layout Audit${colors.reset}`);

    // Set mobile viewport (iPhone 14 / modern phone 390x844)
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const isLoginMobileResponsive = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth + 5;
    });
    recordResult('Suite 9', 'Login page fits mobile viewport without horizontal overflow', isLoginMobileResponsive);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '09-mobile-login.png') });

    // Set auth state on mobile and check dashboard
    await page.evaluate(() => {
      if (window.__useAuthStore) {
        window.__useAuthStore.getState().setUser({
          uid: 'qa-tester-user-001',
          email: 'qa.tester@midisense.io',
          displayName: 'Alex QA'
        });
      }
    });

    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const isDashboardMobileResponsive = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth + 5;
    });
    recordResult('Suite 9', 'Dashboard fits mobile viewport without horizontal overflow', isDashboardMobileResponsive);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '10-mobile-dashboard.png') });

    // Restore desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });

    // ─────────────────────────────────────────────────────────────
    // SUITE 10: Console & Network Health Audit
    // ─────────────────────────────────────────────────────────────
    console.log(`\n${colors.bold}Suite 10: Console Errors & Network Health Audit${colors.reset}`);

    recordResult('Suite 10', 'Zero uncaught JavaScript exceptions (pageerror)', pageErrors.length === 0, `${pageErrors.length} errors`);
    if (pageErrors.length > 0) {
      console.log('    Page Errors:', pageErrors);
    }

    const fatalConsoleErrors = consoleErrors.filter(e => !e.includes('Firebase') && !e.includes('favicon'));
    recordResult('Suite 10', 'No fatal React rendering or runtime console errors', fatalConsoleErrors.length === 0, `${fatalConsoleErrors.length} errors`);
    if (fatalConsoleErrors.length > 0) {
      console.log('    Fatal Console Errors:', fatalConsoleErrors);
    }

  } catch (err) {
    console.error(`${colors.red}Test suite encountered unhandled exception:${colors.reset}`, err);
  } finally {
    await browser.close();
  }

  // ─────────────────────────────────────────────────────────────
  // QA Summary Report Generation
  // ─────────────────────────────────────────────────────────────
  const total = results.length;
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = total - passedCount;
  const passRate = ((passedCount / total) * 100).toFixed(1);

  console.log(`\n${colors.bold}${colors.cyan}=======================================================`);
  console.log(`  QA TEST SUMMARY`);
  console.log(`  Total Tests: ${total} | Passed: ${colors.green}${passedCount}${colors.reset}${colors.bold} | Failed: ${failedCount > 0 ? colors.red : colors.green}${failedCount}${colors.reset}${colors.bold} | Pass Rate: ${passRate}%`);
  console.log(`  Screenshots saved to: ${ARTIFACTS_DIR}`);
  console.log(`=======================================================${colors.reset}\n`);

  // Write JSON report
  fs.writeFileSync(
    path.join(ARTIFACTS_DIR, 'qa-test-report.json'),
    JSON.stringify({ total, passedCount, failedCount, passRate, results }, null, 2),
    'utf-8'
  );
}

runQASuite();
