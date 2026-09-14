const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const path = require("node:path");
const run = promisify(execFile);
const root = path.resolve(__dirname, "../..");
const runnerIndex = process.argv.indexOf("--runner");
const runner = runnerIndex < 0 ? path.join(root, "test-support/moment-browser/run-moment-browser.cjs") : path.resolve(process.argv[runnerIndex + 1] || "");
const cells = [["320x640",320,640,100],["390x844",390,844,100],["768x1024",768,1024,100],["1024x768",1024,768,100],["1440x900",1440,900,100],["720x422",720,422,100],["200% zoom",720,900,200]];
function invariant(value, message) { if (!value) throw new Error(`HiMu Moment browser check failed: ${message}`); }
function verify(report) {
  invariant(Array.isArray(report?.matrix), "runner did not return a matrix.");
  for (const [label,width,height,zoom] of cells) {
    const cell=report.matrix.find((item)=>item?.label===label);
    invariant(cell,`missing ${label}.`);
    invariant(cell.width===width&&cell.height===height&&cell.zoomPercent===zoom,`${label} dimensions are wrong.`);
    invariant(cell.noHorizontalOverflow===true,`${label} overflows horizontally.`);
    invariant(cell.momentVisible===true,`${label} does not render the production Moment card.`);
    invariant(Math.abs((cell.visualViewport?.scale ?? 0) - zoom/100) < .01,`${label} lacks actual page-scale zoom evidence.`);
  }
  const value=report.cases;
  invariant(value?.privateConfirmation?.opened && value.privateConfirmation.role === "dialog", "private-confirmation lacks a semantic dialog.");
  invariant(value.privateConfirmation.initialFocusInDialog === true, "private-confirmation did not move focus into the dialog.");
  invariant(Array.isArray(value.privateConfirmation.traversal) && value.privateConfirmation.traversal.length >= 4 && value.privateConfirmation.traversal.every((step)=>step.inDialog === true), "private-confirmation does not keep Tab and Shift+Tab traversal inside the dialog.");
  invariant(value.privateConfirmation.escapeCancelled && value.privateConfirmation.focusReturned && value.privateConfirmation.programmaticFocusReturned, "private-confirmation must close with Escape and restore focus after programmatic activation.");
  invariant(value?.publicShare?.shareCalls === 1 && value.publicShare.visible, "public-share did not use secure browser sharing.");
  invariant(value?.clipboardFallback?.copyCalls === 1, "clipboard-fallback did not copy once.");
  invariant(value?.clipboardDenied?.copyCalls === 1 && value.clipboardDenied.recovery === true, "clipboard-denied did not expose recovery.");
  invariant(value?.invalidOrigin?.publishDisabled === true && value.invalidOrigin.sharePresent === false, "invalid origin can publish or share.");
  invariant(Array.isArray(report.locales), "missing localization evidence.");
  const english=report.locales.find((locale)=>locale?.locale === "en");
  const spanish=report.locales.find((locale)=>locale?.locale === "es");
  invariant(english?.publishLabel === "Make public and share" && english.yesLabels?.length === 2 && english.yesLabels.every((label)=>label === "Yes"), "English Moment controls are not translated from production i18n.");
  invariant(spanish?.publishLabel === "Hacer pública y compartir" && spanish.yesLabels?.length === 2 && spanish.yesLabels.every((label)=>label === "Sí"), "Spanish Moment controls are not translated from production i18n.");
  invariant(english.feedbackLabels?.join("|") === "Did this result surprise you?|Would you share it?", "English Moment questions are missing.");
  invariant(spanish.feedbackLabels?.join("|") === "¿Te sorprendió este resultado?|¿Lo compartirías?", "Spanish Moment questions are missing.");
  const publicRoute = report.publicRoute;
  const publicCases = ["private", "missing", "noMedia"];
  invariant(publicRoute?.snapshots && typeof publicRoute.snapshots === "object", "missing production public-route snapshots.");
  const publicSnapshots = publicCases.map((name) => publicRoute.snapshots[name]);
  invariant(publicSnapshots.every((snapshot) => typeof snapshot?.alert?.label === "string" && typeof snapshot?.alert?.text === "string" && typeof snapshot?.body === "string"), "production public route did not render the unavailable alert.");
  const unavailableState = JSON.stringify({
    alert: publicSnapshots[0].alert,
    body: publicSnapshots[0].body,
  });
  invariant(publicSnapshots.every((snapshot) => JSON.stringify({ alert: snapshot.alert, body: snapshot.body }) === unavailableState), "private, missing, and no-media tracks must render the same unavailable public state.");
  invariant(Array.isArray(publicRoute.requests) && publicRoute.requests.length === publicCases.length, "public route did not issue one request per unavailable case.");
  const requestIds = new Set();
  for (const request of publicRoute.requests) {
    requestIds.add(request?.id);
    invariant(request?.apikey === "browser-public-key" && request?.authorization === null && request?.cookie === null, "public route must use the anonymous apikey boundary without credentials.");
  }
  invariant(requestIds.size === publicCases.length, "public route unavailable requests were not distinct.");
}
async function main() {
  let stdout;
  try {
    ({ stdout } = await run(process.execPath,[runner],{cwd:root,timeout:180000,maxBuffer:32*1024*1024}));
  } catch (error) {
    throw new Error(`HiMu Moment browser runner failed. stdout=${JSON.stringify(error?.stdout ?? "")} stderr=${JSON.stringify(error?.stderr ?? error?.message ?? "")}`);
  }
  let report;
  try { report=JSON.parse(stdout); } catch { throw new Error(`HiMu Moment browser check failed: runner did not emit JSON. stdout=${JSON.stringify(stdout)}`); }
  verify(report);
  process.stdout.write("HiMu Moment browser matrix verified: responsive, actual page-scale zoom, modal focus, localized controls, share, clipboard, and invalid-origin evidence passed.\n");
}
module.exports = { verify };
if (require.main === module) main().catch((error)=>{process.stderr.write(`${error.stack||error}\n`);process.exitCode=1;});
