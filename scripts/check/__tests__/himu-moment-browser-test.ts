import path from "node:path";
import { readFileSync } from "node:fs";
const root = path.resolve(__dirname, "../../..");
const { verify } = require(path.join(root, "scripts/check/himu-moment-browser.cjs"));
const matrix = [["320x640",320,640,100],["390x844",390,844,100],["768x1024",768,1024,100],["1024x768",1024,768,100],["1440x900",1440,900,100],["720x422",720,422,100],["200% zoom",720,900,200]].map(([label,width,height,zoomPercent])=>({label,width,height,zoomPercent,noHorizontalOverflow:true,momentVisible:true,visualViewport:{scale:zoomPercent/100,devicePixelRatio:1}}));
function report() { return { matrix:matrix.map((cell)=>({...cell,visualViewport:{...cell.visualViewport}})), locales:[{locale:"en",publishLabel:"Make public and share",yesLabels:["Yes","Yes"],feedbackLabels:["Did this result surprise you?","Would you share it?"]},{locale:"es",publishLabel:"Hacer pública y compartir",yesLabels:["Sí","Sí"],feedbackLabels:["¿Te sorprendió este resultado?","¿Lo compartirías?"]}], cases:{ privateConfirmation:{opened:true,role:"dialog",initialFocusInDialog:true,traversal:[{inDialog:true},{inDialog:true},{inDialog:true},{inDialog:true}],escapeCancelled:true,focusReturned:true},publicShare:{shareCalls:1,visible:true},clipboardFallback:{copyCalls:1},clipboardDenied:{copyCalls:1,recovery:true},invalidOrigin:{publishDisabled:true,sharePresent:false} } }; }
describe("HiMu Moment browser evidence checker",()=>{
  it("builds separate valid and invalid-origin production fixtures",()=>{
    const source=readFileSync(path.join(root,"test-support/moment-browser/run-moment-browser.cjs"),"utf8");
    expect(source).toContain('buildFixture("valid", bundles.valid, "https://himu.test")');
    expect(source).toContain('buildFixture("invalid", bundles.invalid, "https://himu.test/path")');
    expect(source).toContain('fixture-invalid-origin.js');
  });
  it("does not use a stubbed public-track route as browser security evidence",()=>{
    const source=readFileSync(path.join(root,"test-support/moment-browser/run-moment-browser.cjs"),"utf8");
    expect(source).not.toContain("public-track-browser-stub");
    expect(source).not.toContain("@/src/hooks/use-public-track");
  });
  it("requires public, private, clipboard, locale, and dialog traversal cases",()=>{ expect(()=>verify(report())).not.toThrow(); });
  it.each(["privateConfirmation","publicShare","clipboardFallback","clipboardDenied"])("rejects missing %s evidence",(key)=>{const value=report() as any; delete value.cases[key]; expect(()=>verify(value)).toThrow();});
  it("rejects an invalid-origin path that can publish",()=>{const value=report();value.cases.invalidOrigin.publishDisabled=false;expect(()=>verify(value)).toThrow(/invalid origin/i);});
  it("rejects a missing compact matrix cell",()=>{const value=report();value.matrix=value.matrix.filter((cell)=>cell.label!=="320x640");expect(()=>verify(value)).toThrow(/320x640/);});
  it("rejects a 200% cell proven only through device pixels instead of page scale",()=>{const value=report();const zoom=value.matrix.find((cell)=>cell.label==="200% zoom");zoom.visualViewport.scale=1;zoom.visualViewport.devicePixelRatio=2;expect(()=>verify(value)).toThrow(/page-scale zoom/i);});
  it("rejects dialog traversal that leaves the modal",()=>{const value=report();value.cases.privateConfirmation.traversal[2].inDialog=false;expect(()=>verify(value)).toThrow(/Tab and Shift\+Tab/i);});
  it("rejects unexercised Spanish labels",()=>{const value=report();value.locales[1].yesLabels=["Yes","Yes"];expect(()=>verify(value)).toThrow(/Spanish/i);});
});
