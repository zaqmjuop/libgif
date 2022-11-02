(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))a(s);new MutationObserver(s=>{for(const i of s)if(i.type==="childList")for(const c of i.addedNodes)c.tagName==="LINK"&&c.rel==="modulepreload"&&a(c)}).observe(document,{childList:!0,subtree:!0});function e(s){const i={};return s.integrity&&(i.integrity=s.integrity),s.referrerpolicy&&(i.referrerPolicy=s.referrerpolicy),s.crossorigin==="use-credentials"?i.credentials="include":s.crossorigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function a(s){if(s.ep)return;s.ep=!0;const i=e(s);fetch(s.href,i)}})();const X="/libgif/assets/coug3.f85a27a3.gif",j="/libgif/assets/earth.b0acdc9a.gif",q="/libgif/assets/img5.64bf3f88.gif",Y="/libgif/assets/gif1.5bf04440.gif",Z="/libgif/assets/gif2.ba77dc11.gif",J="/libgif/assets/gif3.0e5e59d6.gif",M=[X,j,Y,Z,J,q];function Q(r){return{all:r=r||new Map,on:function(t,e){var a=r.get(t);a?a.push(e):r.set(t,[e])},off:function(t,e){var a=r.get(t);a&&(e?a.splice(a.indexOf(e)>>>0,1):r.set(t,[]))},emit:function(t,e){var a=r.get(t);a&&a.slice().map(function(s){s(e)}),(a=r.get("*"))&&a.slice().map(function(s){s(t,e)})}}}class P{constructor(){this.emitter=Q()}on(t,e){return this.emitter.on(t,e)}off(t,e){return this.emitter.off(t,e)}emit(t,e){return this.emitter.emit(t,e)}}const I=new P,O=()=>({data:void 0,progress:0,error:void 0}),w={},V=r=>{if(r in w)return;w[r]=O();const t={...w[r],key:r};I.emit("record",t)},tt=(r,t)=>{w[r]=w[r]||O(),w[r].data=t;const e=100;w[r].progress=e;const a={key:r,data:t,progress:e};I.emit("downloaded",a)},et=(r,t,e)=>{w[r]=w[r]||O(),w[r].progress=t,w[r].data=e;const a={key:r,data:e,progress:t};I.emit("progress",a)},rt=(r,t)=>{w[r]=w[r]||O(),w[r].error=t;const e={...w[r],key:r};I.emit("error",e)},at=r=>{var t;return((t=w[r])==null?void 0:t.progress)>=100?"downloaded":r in w?"record":"none"},st=r=>w[r],y={getDownloadStatus:at,addRecord:V,setProgress:et,setError:rt,setDownload:tt,getDownload:st,on:I.on.bind(I),off:I.off.bind(I)},it=async r=>(y.addRecord(r),await new Promise((t,e)=>{const a=new XMLHttpRequest;a.open("GET",r,!0),"overrideMimeType"in a?a.overrideMimeType("text/plain; charset=x-user-defined"):"responseType"in a?a.responseType="arraybuffer":a.setRequestHeader("Accept-Charset","x-user-defined"),a.onloadstart=()=>{},a.onload=s=>{a.status!=200&&(y.setError(r,"xhr - response"),e("xhr - response"));let i="";typeof a.response=="string"?i=a.response:a.response.toString().indexOf("ArrayBuffer")>0&&(i=new Uint8Array(a.response)),y.setProgress(r,100,i),t(i)},a.onprogress=s=>{const i=s.currentTarget?s.currentTarget.response:"";s.lengthComputable&&y.setProgress(r,s.loaded/s.total,i)},a.onerror=()=>{y.setError(r,"xhr"),e("xhr")},a.send()})),ot=async r=>{const t=y.getDownloadStatus(r);return t==="downloaded"||(t==="none"&&it(r).then(e=>y.setDownload(r,e)),await new Promise(e=>{const a=s=>{s.key===r&&(y.off("downloaded",a),e(s.data))};y.on("downloaded",a)})),y.getDownload(r)},F=(r,t)=>{const e=r[t];if(typeof e!="function")throw new TypeError(`${String(t)} on ${String(r)} is not a Function`);return e.bind(r)},B=new P,f={},N=()=>({header:void 0,frames:[],blocks:[],complete:!1}),nt=r=>{f[r]=f[r]||N(),B.emit("record",{key:r,...f[r]})},ht=(r,t)=>{f[r]=f[r]||N(),f[r].header=t,B.emit("header",{key:r,...f[r]})},ct=(r,t)=>{f[r]=f[r]||N(),f[r].frames.push(...t),B.emit("frame",{key:r,...f[r]})},dt=(r,t)=>{f[r]=f[r]||N(),f[r].blocks.push(...t),B.emit("block",{key:r,...f[r]})},lt=r=>{f[r]=f[r]||N(),f[r].complete=!0,B.emit("decoded",{key:r,...f[r]})},ut=r=>{var t,e,a;return(t=f[r])!=null&&t.complete?"decoded":(e=f[r])!=null&&e.frames.length?"frame":(a=f[r])!=null&&a.header?"header":"none"},pt=r=>f[r],m={getDecodeStatus:ut,addRecord:nt,setHeader:ht,pushBlocks:dt,pushFrames:ct,setComplete:lt,getDecodeData:pt,on:B.on.bind(B),off:B.off.bind(B)},ft=["auto","downloaded","decoded","none"],gt=r=>ft.includes(r);class mt extends P{constructor(t){super(),this.t=0,this.playedFrameNos=new Set,this.loopCount=0,this.playing=!1,this.currentKey=void 0,this.finish=()=>{this.loopCount++,this.loop?this.goOn():(this.pause(),this.emit("playended"))},this.goOn=()=>{if(!this.playing)return;clearTimeout(this.t);const e=this.getNextFrameNo(),a=!this.framsComplete&&e===0?this.currentFrame:this.putFrame(e),s=a?a.delay:17,i=this.framsComplete&&this.getNextFrameNo()===0;this.t=window.setTimeout(i?this.finish:this.goOn,s/this.rate)},this.resetState=()=>{clearTimeout(this.t),this.i=this.beginFrameNo,this.loopCount=0,this.playing=!1,this.playedFrameNos.clear()},this.play=()=>{this.playing||(this.playing=!0,this.goOn(),this.emit("play"))},this.pause=()=>{this.playing=!1,this.emit("pause")},this.onError=()=>{this.resetState()},this.viewer=t.viewer,this.beginFrameNo=typeof t.beginFrameNo=="number"?t.beginFrameNo:0,this._forward=typeof t.forword=="boolean"?t.forword:!0,this._rate=typeof t.rate=="number"?t.rate:1,this._loop=typeof t.loop=="boolean"?t.loop:!0,this.autoplay=gt(t.autoplay)?t.autoplay:"auto",this.i=this.beginFrameNo}get rate(){return this._rate}set rate(t){t>=0&&(this._rate=t)}get forward(){return this._forward}set forward(t){this._forward=t}get loop(){return this._loop}set loop(t){this._loop=t}get currentImg(){return this.currentKey&&m.getDecodeData(this.currentKey)||void 0}get header(){const t=this.currentImg;if(t!=null&&t.header)return{width:t.header.logicalScreenWidth,height:t.header.logicalScreenHeight}}get framsComplete(){var t;return!!((t=this.currentImg)!=null&&t.complete)}get frameGroup(){return this.currentImg?this.currentImg.frames:[]}get readyStatus(){return this.currentKey?m.getDecodeStatus(this.currentKey):"none"}get currentFrame(){return this.frameGroup[this.i]}get currentFrameNo(){return this.i}getNextFrameNo(){const t=this.frameGroup.length;if(!t)return t;const e=this.forward?1:-1;return(this.i+e+t)%t}putFrame(t){const e=this.frameGroup[t];return e&&e.data!==this.viewer.currentImgData&&(this.i=t,this.viewer.putDraft(e.data,e.leftPos,e.topPos),this.viewer.drawDraft(),this.playedFrameNos.add(this.i),this.emit("frameChange")),e}async prepare(){const t=()=>{const e=this.header;return e&&this.viewer.setDraftSize(e),!!e};t()||await new Promise(e=>{const a=()=>t()&&e(m.off("header",a));m.on("header",a)})}async switch(t){this.resetState(),this.currentKey=t,await this.prepare(),this.putFrame(0),this.play()}}const U=r=>r.reduce((t,e)=>t*2+Number(e),0),L=r=>{const t=[];for(let e=7;e>=0;e--)t.push(!!(r&1<<e));return t};class yt{constructor(t=""){this.data="",this.len=0,this.pos=0,this.emitter=new P,this.readByte=async()=>new Promise(e=>{const a=()=>{try{const s=this.readByteSync();this.emitter.off("data",a),e(s)}catch{}};this.emitter.on("data",a),a()}),this.readBytes=async e=>{const a=[];for(let s=0;s<e;s++){const i=await this.readByte();a.push(i)}return a},this.read=async e=>{let a="";for(let s=0;s<e;s++){const i=await this.readByte();a+=String.fromCharCode(i)}return a},this.readUnsigned=async()=>{const[e,a]=await this.readBytes(2);return(a<<8)+e},this.setData(t)}setData(t){this.data=t,this.len=this.data.length,this.emitter.emit("data")}readByteSync(){if(this.pos>=this.data.length)throw new Error("Attempted to read past end of stream.");return this.data instanceof Uint8Array?this.data[this.pos++]:this.data.charCodeAt(this.pos++)&255}}const wt=(r,t)=>{let e=0;const a=p=>{let x=0;for(let g=0;g<p;g++)(t instanceof Uint8Array?t[e>>3]:t.charCodeAt(e>>3))&1<<(e&7)&&(x|=1<<g),e++;return x},s=[],i=1<<r,c=i+1;let d=r+1,n=[];const o=()=>{d=r+1,n=[];for(let p=0;p<i;p++)n[p]=[p];n[i]=[],n[c]=null};let h=0,l;for(;;){if(l=h,h=a(d),h===i){o();continue}else{if(h===c)break;if(h>n.length)throw new Error("Invalid LZW code.");h===n.length?n.push(n[l].concat(n[l][0])):l!==i&&n.push(n[l].concat(n[h][0]))}if(s.push(...n[h]),n.length===1<<d&&d<12&&d++,e>=t.length*8)break}return s},vt=wt;class bt{constructor(){this.canvas=document.createElement("canvas"),this.st=null,this.key="",this.exts=[],this.opacity=255,this.frameGroup=[],this.parseColorTable=async t=>{if(!this.st)return;const e=[];for(let a=0;a<t;a++)e.push(await this.st.readBytes(3));return e},this.readSubBlocks=async()=>{if(!this.st)return;let t,e;e="";do t=await this.st.readByte(),e+=await this.st.read(t);while(t!==0);return e},this.parseHeader=async()=>{if(!this.st)return;const t=await this.st.read(3),e=await this.st.read(3);if(t!=="GIF")throw new Error("Not a GIF file.");const a=await this.st.readUnsigned(),s=await this.st.readUnsigned(),i=L(await this.st.readByte()),c=!!i.shift(),d=U(i.splice(0,3)),n=!!i.shift(),o=U(i.splice(0,3)),h=await this.st.readByte(),l=await this.st.readByte(),p=c?await this.parseColorTable(1<<o+1):void 0,x=p?p[h]:null,g={signature:t,version:e,logicalScreenWidth:a,logicalScreenHeight:s,globalColorTableFlag:c,ColorResolution:d,sortFlag:n,ColorTableSize:o,backgroundColorIndex:h,backgroundColor:x,pixelAspectRatio:l,globalColorTable:p};return this.header=g,this.setCanvasSize(g.logicalScreenWidth,g.logicalScreenHeight),m.setHeader(this.key,g),g},this.parseExt=async t=>{if(!this.st)return;const e=async o=>{if(!this.st)return;await this.st.readByte();const h=L(await this.st.readByte()),l=h.splice(0,3),p=U(h.splice(0,3)),x=!!h.shift(),g=!!h.shift(),k=await this.st.readUnsigned()*10,u=await this.st.readByte(),v=await this.st.readByte(),T={...o,reserved:l,disposalMethod:p,userInput:x,transparencyGiven:g,delayTime:k,transparencyIndex:u,terminator:v};this.graphControll=T},a=async o=>{if(!this.st)return;const h=await this.readSubBlocks(),l={...o,comment:h};return this.exts.push(l),m.pushBlocks(this.key,[l]),l},s=async o=>{if(!this.st)return;await this.st.readByte();const h=await this.st.readBytes(12),l=await this.readSubBlocks(),p={...o,ptHeader:h,ptData:l};return this.exts.push(p),m.pushBlocks(this.key,[p]),p},i=async o=>{if(!this.st)return;const h=async k=>{if(!this.st)return;await this.st.readByte();const u=await this.st.readByte(),v=await this.st.readUnsigned(),T=await this.st.readByte(),D={...k,unknown:u,iterations:v,terminator:T,identifier:"NETSCAPE"};return this.app=D,m.pushBlocks(this.key,[D]),D},l=async k=>{const u=await this.readSubBlocks(),v={...k,appData:u,identifier:k.identifier};return this.app=v,m.pushBlocks(this.key,[v]),v};await this.st.readByte();const p=await this.st.read(8),x=await this.st.read(3),g={...o,identifier:p,authCode:x};switch(g.identifier){case"NETSCAPE":await h(g);break;default:await l(g);break}return g},c=async o=>{const h=await this.readSubBlocks(),l={...o,data:h};return this.exts.push(l),m.pushBlocks(this.key,[l]),l},d=await this.st.readByte(),n={...t,label:d,extType:""};switch(n.label){case 249:return n.extType="gce",e(n);case 254:return n.extType="com",a(n);case 1:return n.extType="pte",s(n);case 255:return n.extType="app",i(n);default:return n.extType="unknown",c(n)}},this.parseImg=async t=>{if(!this.st)return;const e=(D,C)=>{const E=new Array(D.length),z=D.length/C,G=(S,$)=>{const W=D.slice($*C,($+1)*C);E.splice(S*C,C,...W)},R=[0,4,2,1],A=[8,8,4,2];let b=0;for(let S=0;S<4;S++)for(let $=R[S];$<z;$+=A[S])G($,b),b++;return E},a=await this.st.readUnsigned(),s=await this.st.readUnsigned(),i=await this.st.readUnsigned(),c=await this.st.readUnsigned(),d=L(await this.st.readByte()),n=d.shift(),o=d.shift(),h=d.shift(),l=d.splice(0,2),p=U(d.splice(0,3)),x=n?await this.parseColorTable(1<<p+1):void 0,g=await this.st.readByte(),k=await this.readSubBlocks();let u=await vt(g,k);o&&(u=e(u,i));const v={...t,leftPos:a,topPos:s,width:i,height:c,lctFlag:n,interlaced:o,sorted:h,reserved:l,lctSize:p,lct:x,lzwMinCodeSize:g,pixels:u},T=this.parseFrame(v);return{...v,frame:T}},this.parseFrame=t=>{var e;const a=this.graphControll;a&&this.disposal(a.disposalMethod);const s=a&&a.transparencyGiven?a.transparencyIndex:null,i=a&&a.delayTime||100,c=t.lctFlag?t.lct:(e=this.header)==null?void 0:e.globalColorTable,d=this.ctx.getImageData(t.leftPos,t.topPos,t.width,t.height);c&&t.pixels.forEach((o,h)=>{o!==s&&(d.data[h*4+0]=c[o][0],d.data[h*4+1]=c[o][1],d.data[h*4+2]=c[o][2],d.data[h*4+3]=this.opacity)}),this.ctx.putImageData(d,t.leftPos,t.topPos,0,0,t.width,t.height);const n={data:this.ctx.getImageData(0,0,this.canvas.width,this.canvas.height),delay:i,leftPos:0,topPos:0,width:this.canvas.width,height:this.canvas.height};return this.frameGroup.push(n),this.graphControll=void 0,m.pushFrames(this.key,[n]),n},this.putDraft=(t,e=0,a=0)=>{const{width:s,height:i}=this.canvas;t?t instanceof ImageData?this.ctx.putImageData(t,e,a):(this.ctx.fillStyle=`rgb(${t.join(",")} )`,this.ctx.fillRect(0,0,s,i)):this.ctx.clearRect(0,0,s,i)},this.parseBlock=async()=>{if(!this.st)return;const t={sentinel:await this.st.readByte(),type:""},e=()=>(t.type="complete",this.st=null,this.key="",t);switch(String.fromCharCode(t.sentinel)){case"!":return t.type="ext",this.parseExt(t);case",":return t.type="img",this.parseImg(t);case";":return e();case"\0":return e();default:throw new Error("Unknown block: 0x"+t.sentinel.toString(16))}},this.parse=async(t,e,a)=>{if(this.st)return;this.st=t,this.key=e,a&&(this.opacity=a.opacity);const s=[],i=await this.parseHeader();for(;this.st;){const d=await new Promise(n=>{setTimeout(()=>n(this.parseBlock()),0)});d&&s.push(d)}const c={header:i,blocks:s,frameGroup:this.frameGroup,opacity:this.opacity};return m.setComplete(e),c},this.ctx=this.canvas.getContext("2d",{willReadFrequently:!0})}get pos(){var t;return((t=this.st)==null?void 0:t.pos)||0}get len(){var t;return((t=this.st)==null?void 0:t.data.length)||0}get loading(){return!!this.st}setCanvasSize(t,e){this.canvas.width=t,this.canvas.height=e,this.canvas.style.width=t+"px",this.canvas.style.height=e+"px",this.ctx.setTransform(1,0,0,1,0,0)}disposal(t){const e=a=>{var s;const i=this.frameGroup[a];i?this.putDraft(i.data,i.leftPos,i.topPos):this.putDraft(((s=this.header)==null?void 0:s.backgroundColor)||null)};switch(t){case 3:e(this.frameGroup.length-1);break;case 2:e(-1);break}}}const xt=async(r,t)=>{m.addRecord(r);const e=y.getDownload(r),a=new yt(e.data||"");if(e.progress<100){const s=c=>{c.key===r&&a.setData(c.data)},i=c=>{c.key===r&&(a.setData(c.data),y.off("progress",s),y.off("downloaded",i))};y.on("progress",s),y.on("downloaded",i)}return await new bt().parse(a,r,t)},kt=async(r,t)=>{const e=m.getDecodeStatus(r);return e==="decoded"||(e==="none"&&xt(r,t),await new Promise(a=>{const s=()=>{m.off("decoded",s),a(void 0)};m.on("decoded",s)})),m.getDecodeData(r)};class Ct extends P{constructor(){super(),this.draftCanvas=document.createElement("canvas"),this.currentImgData=null,this.drawError=t=>{if(!this.canvas||!this.ctx)return;this.ctx.fillStyle="black";const e=this.canvas.width,a=this.canvas.height;this.ctx.fillRect(0,0,e,a),this.ctx.strokeStyle="red",this.ctx.lineWidth=3,this.ctx.moveTo(0,0),this.ctx.lineTo(e,a),this.ctx.moveTo(0,a),this.ctx.lineTo(e,0),this.ctx.stroke()},this.resizeObserver=new ResizeObserver(this.onResize.bind(this)),this.draftCtx=this.draftCanvas.getContext("2d")}get scale(){var t,e;const a=((t=this.canvas)==null?void 0:t.width)||0,s=this.draftCanvas.width,i=((e=this.canvas)==null?void 0:e.height)||0,c=this.draftCanvas.height;return{zoomW:a/s,zoomH:i/c}}updateScale(){var t,e;(t=this.ctx)==null||t.setTransform(1,0,0,1,0,0);const{zoomW:a,zoomH:s}=this.scale;(e=this.ctx)==null||e.scale(a,s)}onResize(){!this.canvas||!this.ctx||(this.updateScale(),this.drawDraft())}mount(t){this.canvas=t,this.ctx=this.canvas.getContext("2d"),this.resizeObserver.observe(t)}setDraftSize(t){!this.canvas||(this.draftCanvas.width=t.width,this.draftCanvas.height=t.height,this.draftCanvas.style.width=t.width+"px",this.draftCanvas.style.height=t.height+"px",this.draftCtx.setTransform(1,0,0,1,0,0),this.updateScale())}putDraft(t,e=0,a=0){const{width:s,height:i}=this.draftCanvas;this.currentImgData=t,t?t instanceof ImageData?this.draftCtx.putImageData(t,e,a,0,0,s,i):(this.draftCtx.fillStyle=`rgb(${t.join(",")} )`,this.draftCtx.fillRect(0,0,s,i)):this.draftCtx.clearRect(0,0,s,i)}drawDraft(){var t;(t=this.ctx)==null||t.drawImage(this.draftCanvas,0,0)}}const St=255,Dt=r=>{const t=new P,e=r.gif;let a=r.src||"";const s=new Ct;s.mount(e);const i=new mt({viewer:s,beginFrameNo:r.beginFrameNo,forword:r.forword,rate:r.rate,loop:r.loop,autoplay:r.autoplay}),c=o=>{o.key===a&&(i.onError(),s.drawError(o.error||""),t.emit("error",o))};y.on("error",c);const d=async o=>{a=o;try{y.getDownloadStatus(o)==="none"&&ot(o),m.getDecodeStatus(o)==="none"&&kt(o,{opacity:St}),i.switch(o)}catch{const h={error:`load url error with\u3010${o}\u3011`};s.drawError(h.error),t.emit("error",h)}},n={get playing(){return i.playing},get loopCount(){return i.loopCount},get currentKey(){return i.currentKey},get currentFrameNo(){return i.currentFrameNo},get rate(){return i.rate},set rate(o){i.rate=o},get forward(){return i.forward},set forward(o){i.forward=o},get loop(){return i.loop},set loop(o){i.loop=o},play:F(i,"play"),pause:F(i,"pause"),jumpTo:F(i,"putFrame"),loadUrl:d,getDecodeData:F(m,"getDecodeData"),getDownload:F(y,"getDownload"),on:F(t,"on"),off:F(t,"off")};return i.on("play",o=>t.emit("play",o)),i.on("frameChange",o=>t.emit("frameChange",o)),i.on("pause",o=>t.emit("pause",o)),i.on("playended",o=>t.emit("playended",o)),m.on("decoded",o=>t.emit("decoded",o)),y.on("downloaded",o=>t.emit("downloaded",o)),y.on("progress",o=>t.emit("progress",o)),e.controller=n,a&&d(a),n};let H=0;const K=()=>(H>65535&&(H=-H),`${(H++).toString(16)}`),_=(r=0)=>{const t=K(),e=document.createElement("div");e.id=t,e.classList.add("example"),document.body.append(e);const a=M[r],s=K(),i=200,c=200;let d=1,n=1;const o=`${s}x`,h=`${s}y`,l=`${s}rate`,p=`${s}forword`,x=`${s}loop`,g=`${s}pause`;e.innerHTML=` 
    <div style="margin: 8px 0">
     ${M.map((b,S)=>`<button url="${b}">GIF${S}</button>`).join(" ")}
    </div>
    <div>
    <label>
      <span>width</span>
      <input id="${o}" type="range" max=20 min=1 step=2 value=${d*10}/>
    </label>
    <label>
      <span>height</span>
      <input id="${h}" type="range" max=20 min=1 step=2 value=${n*10}/>
    </label>
    <label>
      <span>rate</span>
      <input id="${l}" type="range" max=20 min=1 step=2 value=${10}/>
    </label>
    <div>
      <button id=${g}>pause</button>
      <button id=${p}>forword</button>
      <button id=${x}>loop</button>
    </div>

    </div>
    <canvas
      id="${s}" 
      width="${i}"
      height="${c}" 
    /> 
  `;const k=document.getElementById(s),u=Dt({gif:k,src:a});console.log(u);const v=document.getElementById(o),T=()=>{const b=v.value;d=parseInt(v.value)/10,v.setAttribute("value",b),k.width=i*d},D=()=>{const b=C.value;n=parseInt(C.value)/10,C.setAttribute("value",b),k.height=c*n};v&&(v.oninput=T);const C=document.getElementById(h);C&&(C.oninput=D);const E=document.getElementById(l);E.oninput=()=>{const b=parseInt(E.value);u.rate=b/10,E.value=`${b}`};const z=document.getElementById(p);z.onclick=()=>{u.forward=!u.forward,z.innerText=`forword:${u.forward}`};const G=document.getElementById(x);G.onclick=()=>{u.loop=!u.loop,G.innerText=`loop:${u.loop}`};const R=document.getElementById(g),A=()=>R.innerText=u.playing?"pause":"play";return R.onclick=()=>{u.playing?u.pause():u.play(),A()},u.on("playended",A),e.addEventListener("click",b=>{if(b.target instanceof HTMLElement){const S=b.target.getAttribute("url");S&&u.loadUrl(S)}}),u};_(0);_(1);
