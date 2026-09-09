import path from "node:path";
import { readFileSync } from "node:fs";
const root = path.resolve(__dirname, "../../..");
const { verify } = require(path.join(root, "scripts/check/himu-moment-browser.cjs"));
const matrix = [["320x640",320,640,100],["390x844",390,844,100],["768x1024",768,1024,100],["1024x768",1024,768,100],["1440x900",1440,900,100],["720x422",720,422,100],["200% zoom",720,900,200]].map(([label,width,height,zoomPercent])=>({label,width,height,zoomPercent,noHorizontalOverflow:true,momentVisible:true,visualViewport:{scale:1,devicePixelRatio:zoomPercent/100}}));
function report() { return { matrix, locales:["en","es"], cases:{ privateConfirmation:{opened:true,role:"dialog",escapeCancelled:true,focusReturned:true,tabForward:"Cancel",shiftTabReturn:"moment-publish"},publicShare:{shareCalls:1,visible:true},clipboardFallback:{copyCalls:1},clipboardDenied:{copyCalls:1,recovery:true},invalidOrigin:{publishDisabled:true,sharePresent:false},publicUnavailable:{same:true,privateBody:"Track unavailable",missingBody:"Track unavailable"} } }; }
describe("HiMu Moment browser evidence checker",()=>{
  it("builds separate valid and invalid-origin production fixtures",()=>{
    const source=readFileSync(path.join(root,"test-support/moment-browser/run-moment-browser.cjs"),"utf8");
    expect(source).toContain('buildFixture("valid", bundles.valid, "https://himu.test")');
    expect(source).toContain('buildFixture("invalid", bundles.invalid, "https://himu.test/path")');
    expect(source).toContain('fixture-invalid-origin.js');
  });
  it("requires public, private, clipboard, and unavailable cases",()=>{ expect(()=>verify(report())).not.toThrow(); });
  it.each(["privateConfirmation","publicShare","clipboardFallback","clipboardDenied","publicUnavailable"])("rejects missing %s evidence",(key)=>{const value=report() as any; delete value.cases[key]; expect(()=>verify(value)).toThrow();});
  it("rejects an invalid-origin path that can publish",()=>{const value=report();value.cases.invalidOrigin.publishDisabled=false;expect(()=>verify(value)).toThrow(/invalid origin/i);});
  it("rejects a missing compact matrix cell",()=>{const value=report();value.matrix=value.matrix.filter((cell)=>cell.label!=="320x640");expect(()=>verify(value)).toThrow(/320x640/);});
});
