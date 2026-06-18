/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol, Iterator */


function __decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const t$2=globalThis,e$2=t$2.ShadowRoot&&(void 0===t$2.ShadyCSS||t$2.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,s$2=Symbol(),o$4=new WeakMap;let n$3 = class n{constructor(t,e,o){if(this._$cssResult$=true,o!==s$2)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e;}get styleSheet(){let t=this.o;const s=this.t;if(e$2&&void 0===t){const e=void 0!==s&&1===s.length;e&&(t=o$4.get(s)),void 0===t&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),e&&o$4.set(s,t));}return t}toString(){return this.cssText}};const r$4=t=>new n$3("string"==typeof t?t:t+"",void 0,s$2),i$3=(t,...e)=>{const o=1===t.length?t[0]:e.reduce((e,s,o)=>e+(t=>{if(true===t._$cssResult$)return t.cssText;if("number"==typeof t)return t;throw Error("Value passed to 'css' function must be a 'css' function result: "+t+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(s)+t[o+1],t[0]);return new n$3(o,t,s$2)},S$1=(s,o)=>{if(e$2)s.adoptedStyleSheets=o.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(const e of o){const o=document.createElement("style"),n=t$2.litNonce;void 0!==n&&o.setAttribute("nonce",n),o.textContent=e.cssText,s.appendChild(o);}},c$2=e$2?t=>t:t=>t instanceof CSSStyleSheet?(t=>{let e="";for(const s of t.cssRules)e+=s.cssText;return r$4(e)})(t):t;

/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:i$2,defineProperty:e$1,getOwnPropertyDescriptor:h$1,getOwnPropertyNames:r$3,getOwnPropertySymbols:o$3,getPrototypeOf:n$2}=Object,a$1=globalThis,c$1=a$1.trustedTypes,l$1=c$1?c$1.emptyScript:"",p$1=a$1.reactiveElementPolyfillSupport,d$1=(t,s)=>t,u$1={toAttribute(t,s){switch(s){case Boolean:t=t?l$1:null;break;case Object:case Array:t=null==t?t:JSON.stringify(t);}return t},fromAttribute(t,s){let i=t;switch(s){case Boolean:i=null!==t;break;case Number:i=null===t?null:Number(t);break;case Object:case Array:try{i=JSON.parse(t);}catch(t){i=null;}}return i}},f$1=(t,s)=>!i$2(t,s),b$1={attribute:true,type:String,converter:u$1,reflect:false,useDefault:false,hasChanged:f$1};Symbol.metadata??=Symbol("metadata"),a$1.litPropertyMetadata??=new WeakMap;let y$1 = class y extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t);}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,s=b$1){if(s.state&&(s.attribute=false),this._$Ei(),this.prototype.hasOwnProperty(t)&&((s=Object.create(s)).wrapped=true),this.elementProperties.set(t,s),!s.noAccessor){const i=Symbol(),h=this.getPropertyDescriptor(t,i,s);void 0!==h&&e$1(this.prototype,t,h);}}static getPropertyDescriptor(t,s,i){const{get:e,set:r}=h$1(this.prototype,t)??{get(){return this[s]},set(t){this[s]=t;}};return {get:e,set(s){const h=e?.call(this);r?.call(this,s),this.requestUpdate(t,h,i);},configurable:true,enumerable:true}}static getPropertyOptions(t){return this.elementProperties.get(t)??b$1}static _$Ei(){if(this.hasOwnProperty(d$1("elementProperties")))return;const t=n$2(this);t.finalize(),void 0!==t.l&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties);}static finalize(){if(this.hasOwnProperty(d$1("finalized")))return;if(this.finalized=true,this._$Ei(),this.hasOwnProperty(d$1("properties"))){const t=this.properties,s=[...r$3(t),...o$3(t)];for(const i of s)this.createProperty(i,t[i]);}const t=this[Symbol.metadata];if(null!==t){const s=litPropertyMetadata.get(t);if(void 0!==s)for(const[t,i]of s)this.elementProperties.set(t,i);}this._$Eh=new Map;for(const[t,s]of this.elementProperties){const i=this._$Eu(t,s);void 0!==i&&this._$Eh.set(i,t);}this.elementStyles=this.finalizeStyles(this.styles);}static finalizeStyles(s){const i=[];if(Array.isArray(s)){const e=new Set(s.flat(1/0).reverse());for(const s of e)i.unshift(c$2(s));}else void 0!==s&&i.push(c$2(s));return i}static _$Eu(t,s){const i=s.attribute;return  false===i?void 0:"string"==typeof i?i:"string"==typeof t?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=false,this.hasUpdated=false,this._$Em=null,this._$Ev();}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this));}addController(t){(this._$EO??=new Set).add(t),void 0!==this.renderRoot&&this.isConnected&&t.hostConnected?.();}removeController(t){this._$EO?.delete(t);}_$E_(){const t=new Map,s=this.constructor.elementProperties;for(const i of s.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t);}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return S$1(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(true),this._$EO?.forEach(t=>t.hostConnected?.());}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.());}attributeChangedCallback(t,s,i){this._$AK(t,i);}_$ET(t,s){const i=this.constructor.elementProperties.get(t),e=this.constructor._$Eu(t,i);if(void 0!==e&&true===i.reflect){const h=(void 0!==i.converter?.toAttribute?i.converter:u$1).toAttribute(s,i.type);this._$Em=t,null==h?this.removeAttribute(e):this.setAttribute(e,h),this._$Em=null;}}_$AK(t,s){const i=this.constructor,e=i._$Eh.get(t);if(void 0!==e&&this._$Em!==e){const t=i.getPropertyOptions(e),h="function"==typeof t.converter?{fromAttribute:t.converter}:void 0!==t.converter?.fromAttribute?t.converter:u$1;this._$Em=e;const r=h.fromAttribute(s,t.type);this[e]=r??this._$Ej?.get(e)??r,this._$Em=null;}}requestUpdate(t,s,i,e=false,h){if(void 0!==t){const r=this.constructor;if(false===e&&(h=this[t]),i??=r.getPropertyOptions(t),!((i.hasChanged??f$1)(h,s)||i.useDefault&&i.reflect&&h===this._$Ej?.get(t)&&!this.hasAttribute(r._$Eu(t,i))))return;this.C(t,s,i);} false===this.isUpdatePending&&(this._$ES=this._$EP());}C(t,s,{useDefault:i,reflect:e,wrapped:h},r){i&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,r??s??this[t]),true!==h||void 0!==r)||(this._$AL.has(t)||(this.hasUpdated||i||(s=void 0),this._$AL.set(t,s)),true===e&&this._$Em!==t&&(this._$Eq??=new Set).add(t));}async _$EP(){this.isUpdatePending=true;try{await this._$ES;}catch(t){Promise.reject(t);}const t=this.scheduleUpdate();return null!=t&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[t,s]of this._$Ep)this[t]=s;this._$Ep=void 0;}const t=this.constructor.elementProperties;if(t.size>0)for(const[s,i]of t){const{wrapped:t}=i,e=this[s];true!==t||this._$AL.has(s)||void 0===e||this.C(s,void 0,i,e);}}let t=false;const s=this._$AL;try{t=this.shouldUpdate(s),t?(this.willUpdate(s),this._$EO?.forEach(t=>t.hostUpdate?.()),this.update(s)):this._$EM();}catch(s){throw t=false,this._$EM(),s}t&&this._$AE(s);}willUpdate(t){}_$AE(t){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=true,this.firstUpdated(t)),this.updated(t);}_$EM(){this._$AL=new Map,this.isUpdatePending=false;}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return  true}update(t){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM();}updated(t){}firstUpdated(t){}};y$1.elementStyles=[],y$1.shadowRootOptions={mode:"open"},y$1[d$1("elementProperties")]=new Map,y$1[d$1("finalized")]=new Map,p$1?.({ReactiveElement:y$1}),(a$1.reactiveElementVersions??=[]).push("2.1.2");

/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const t$1=globalThis,i$1=t=>t,s$1=t$1.trustedTypes,e=s$1?s$1.createPolicy("lit-html",{createHTML:t=>t}):void 0,h="$lit$",o$2=`lit$${Math.random().toFixed(9).slice(2)}$`,n$1="?"+o$2,r$2=`<${n$1}>`,l=document,c=()=>l.createComment(""),a=t=>null===t||"object"!=typeof t&&"function"!=typeof t,u=Array.isArray,d=t=>u(t)||"function"==typeof t?.[Symbol.iterator],f="[ \t\n\f\r]",v=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,_=/-->/g,m=/>/g,p=RegExp(`>|${f}(?:([^\\s"'>=/]+)(${f}*=${f}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),g=/'/g,$=/"/g,y=/^(?:script|style|textarea|title)$/i,x=t=>(i,...s)=>({_$litType$:t,strings:i,values:s}),b=x(1),E=Symbol.for("lit-noChange"),A=Symbol.for("lit-nothing"),C=new WeakMap,P=l.createTreeWalker(l,129);function V(t,i){if(!u(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==e?e.createHTML(i):i}const N=(t,i)=>{const s=t.length-1,e=[];let n,l=2===i?"<svg>":3===i?"<math>":"",c=v;for(let i=0;i<s;i++){const s=t[i];let a,u,d=-1,f=0;for(;f<s.length&&(c.lastIndex=f,u=c.exec(s),null!==u);)f=c.lastIndex,c===v?"!--"===u[1]?c=_:void 0!==u[1]?c=m:void 0!==u[2]?(y.test(u[2])&&(n=RegExp("</"+u[2],"g")),c=p):void 0!==u[3]&&(c=p):c===p?">"===u[0]?(c=n??v,d=-1):void 0===u[1]?d=-2:(d=c.lastIndex-u[2].length,a=u[1],c=void 0===u[3]?p:'"'===u[3]?$:g):c===$||c===g?c=p:c===_||c===m?c=v:(c=p,n=void 0);const x=c===p&&t[i+1].startsWith("/>")?" ":"";l+=c===v?s+r$2:d>=0?(e.push(a),s.slice(0,d)+h+s.slice(d)+o$2+x):s+o$2+(-2===d?i:x);}return [V(t,l+(t[s]||"<?>")+(2===i?"</svg>":3===i?"</math>":"")),e]};class S{constructor({strings:t,_$litType$:i},e){let r;this.parts=[];let l=0,a=0;const u=t.length-1,d=this.parts,[f,v]=N(t,i);if(this.el=S.createElement(f,e),P.currentNode=this.el.content,2===i||3===i){const t=this.el.content.firstChild;t.replaceWith(...t.childNodes);}for(;null!==(r=P.nextNode())&&d.length<u;){if(1===r.nodeType){if(r.hasAttributes())for(const t of r.getAttributeNames())if(t.endsWith(h)){const i=v[a++],s=r.getAttribute(t).split(o$2),e=/([.?@])?(.*)/.exec(i);d.push({type:1,index:l,name:e[2],strings:s,ctor:"."===e[1]?I:"?"===e[1]?L:"@"===e[1]?z:H}),r.removeAttribute(t);}else t.startsWith(o$2)&&(d.push({type:6,index:l}),r.removeAttribute(t));if(y.test(r.tagName)){const t=r.textContent.split(o$2),i=t.length-1;if(i>0){r.textContent=s$1?s$1.emptyScript:"";for(let s=0;s<i;s++)r.append(t[s],c()),P.nextNode(),d.push({type:2,index:++l});r.append(t[i],c());}}}else if(8===r.nodeType)if(r.data===n$1)d.push({type:2,index:l});else {let t=-1;for(;-1!==(t=r.data.indexOf(o$2,t+1));)d.push({type:7,index:l}),t+=o$2.length-1;}l++;}}static createElement(t,i){const s=l.createElement("template");return s.innerHTML=t,s}}function M(t,i,s=t,e){if(i===E)return i;let h=void 0!==e?s._$Co?.[e]:s._$Cl;const o=a(i)?void 0:i._$litDirective$;return h?.constructor!==o&&(h?._$AO?.(false),void 0===o?h=void 0:(h=new o(t),h._$AT(t,s,e)),void 0!==e?(s._$Co??=[])[e]=h:s._$Cl=h),void 0!==h&&(i=M(t,h._$AS(t,i.values),h,e)),i}class R{constructor(t,i){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=i;}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:i},parts:s}=this._$AD,e=(t?.creationScope??l).importNode(i,true);P.currentNode=e;let h=P.nextNode(),o=0,n=0,r=s[0];for(;void 0!==r;){if(o===r.index){let i;2===r.type?i=new k(h,h.nextSibling,this,t):1===r.type?i=new r.ctor(h,r.name,r.strings,this,t):6===r.type&&(i=new Z(h,this,t)),this._$AV.push(i),r=s[++n];}o!==r?.index&&(h=P.nextNode(),o++);}return P.currentNode=l,e}p(t){let i=0;for(const s of this._$AV) void 0!==s&&(void 0!==s.strings?(s._$AI(t,s,i),i+=s.strings.length-2):s._$AI(t[i])),i++;}}class k{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,i,s,e){this.type=2,this._$AH=A,this._$AN=void 0,this._$AA=t,this._$AB=i,this._$AM=s,this.options=e,this._$Cv=e?.isConnected??true;}get parentNode(){let t=this._$AA.parentNode;const i=this._$AM;return void 0!==i&&11===t?.nodeType&&(t=i.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,i=this){t=M(this,t,i),a(t)?t===A||null==t||""===t?(this._$AH!==A&&this._$AR(),this._$AH=A):t!==this._$AH&&t!==E&&this._(t):void 0!==t._$litType$?this.$(t):void 0!==t.nodeType?this.T(t):d(t)?this.k(t):this._(t);}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t));}_(t){this._$AH!==A&&a(this._$AH)?this._$AA.nextSibling.data=t:this.T(l.createTextNode(t)),this._$AH=t;}$(t){const{values:i,_$litType$:s}=t,e="number"==typeof s?this._$AC(t):(void 0===s.el&&(s.el=S.createElement(V(s.h,s.h[0]),this.options)),s);if(this._$AH?._$AD===e)this._$AH.p(i);else {const t=new R(e,this),s=t.u(this.options);t.p(i),this.T(s),this._$AH=t;}}_$AC(t){let i=C.get(t.strings);return void 0===i&&C.set(t.strings,i=new S(t)),i}k(t){u(this._$AH)||(this._$AH=[],this._$AR());const i=this._$AH;let s,e=0;for(const h of t)e===i.length?i.push(s=new k(this.O(c()),this.O(c()),this,this.options)):s=i[e],s._$AI(h),e++;e<i.length&&(this._$AR(s&&s._$AB.nextSibling,e),i.length=e);}_$AR(t=this._$AA.nextSibling,s){for(this._$AP?.(false,true,s);t!==this._$AB;){const s=i$1(t).nextSibling;i$1(t).remove(),t=s;}}setConnected(t){ void 0===this._$AM&&(this._$Cv=t,this._$AP?.(t));}}class H{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,i,s,e,h){this.type=1,this._$AH=A,this._$AN=void 0,this.element=t,this.name=i,this._$AM=e,this.options=h,s.length>2||""!==s[0]||""!==s[1]?(this._$AH=Array(s.length-1).fill(new String),this.strings=s):this._$AH=A;}_$AI(t,i=this,s,e){const h=this.strings;let o=false;if(void 0===h)t=M(this,t,i,0),o=!a(t)||t!==this._$AH&&t!==E,o&&(this._$AH=t);else {const e=t;let n,r;for(t=h[0],n=0;n<h.length-1;n++)r=M(this,e[s+n],i,n),r===E&&(r=this._$AH[n]),o||=!a(r)||r!==this._$AH[n],r===A?t=A:t!==A&&(t+=(r??"")+h[n+1]),this._$AH[n]=r;}o&&!e&&this.j(t);}j(t){t===A?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"");}}class I extends H{constructor(){super(...arguments),this.type=3;}j(t){this.element[this.name]=t===A?void 0:t;}}class L extends H{constructor(){super(...arguments),this.type=4;}j(t){this.element.toggleAttribute(this.name,!!t&&t!==A);}}class z extends H{constructor(t,i,s,e,h){super(t,i,s,e,h),this.type=5;}_$AI(t,i=this){if((t=M(this,t,i,0)??A)===E)return;const s=this._$AH,e=t===A&&s!==A||t.capture!==s.capture||t.once!==s.once||t.passive!==s.passive,h=t!==A&&(s===A||e);e&&this.element.removeEventListener(this.name,this,s),h&&this.element.addEventListener(this.name,this,t),this._$AH=t;}handleEvent(t){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t);}}class Z{constructor(t,i,s){this.element=t,this.type=6,this._$AN=void 0,this._$AM=i,this.options=s;}get _$AU(){return this._$AM._$AU}_$AI(t){M(this,t);}}const B=t$1.litHtmlPolyfillSupport;B?.(S,k),(t$1.litHtmlVersions??=[]).push("3.3.3");const D=(t,i,s)=>{const e=s?.renderBefore??i;let h=e._$litPart$;if(void 0===h){const t=s?.renderBefore??null;e._$litPart$=h=new k(i.insertBefore(c(),t),t,void 0,s??{});}return h._$AI(t),h};

/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const s=globalThis;class i extends y$1{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0;}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const r=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=D(r,this.renderRoot,this.renderOptions);}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(true);}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(false);}render(){return E}}i._$litElement$=true,i["finalized"]=true,s.litElementHydrateSupport?.({LitElement:i});const o$1=s.litElementPolyfillSupport;o$1?.({LitElement:i});(s.litElementVersions??=[]).push("4.2.2");

/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const t=t=>(e,o)=>{ void 0!==o?o.addInitializer(()=>{customElements.define(t,e);}):customElements.define(t,e);};

/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const o={attribute:true,type:String,converter:u$1,reflect:false,hasChanged:f$1},r$1=(t=o,e,r)=>{const{kind:n,metadata:i}=r;let s=globalThis.litPropertyMetadata.get(i);if(void 0===s&&globalThis.litPropertyMetadata.set(i,s=new Map),"setter"===n&&((t=Object.create(t)).wrapped=true),s.set(r.name,t),"accessor"===n){const{name:o}=r;return {set(r){const n=e.get.call(this);e.set.call(this,r),this.requestUpdate(o,n,t,true,r);},init(e){return void 0!==e&&this.C(o,void 0,t,e),e}}}if("setter"===n){const{name:o}=r;return function(r){const n=this[o];e.call(this,r),this.requestUpdate(o,n,t,true,r);}}throw Error("Unsupported decorator location: "+n)};function n(t){return (e,o)=>"object"==typeof o?r$1(t,e,o):((t,e,o)=>{const r=e.hasOwnProperty(o);return e.constructor.createProperty(o,t),r?Object.getOwnPropertyDescriptor(e,o):void 0})(t,e,o)}

/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function r(r){return n({...r,state:true,attribute:false})}

/** Subscribe to the live alarm collection. Returns the unsubscribe promise. */
function subscribeAlarms(hass, onChange) {
    const items = new Map();
    const apply = (ch) => {
        if ((ch.change_type === "added" || ch.change_type === "updated") && ch.item) {
            items.set(ch.item.id, ch.item);
        }
        else if (ch.change_type === "removed") {
            const id = ch.alarm_id ?? ch.item?.id;
            if (id)
                items.delete(id);
        }
    };
    return hass.connection.subscribeMessage((msg) => {
        // HA sends an array of changes (and the initial state as added changes).
        if (Array.isArray(msg)) {
            msg.forEach(apply);
        }
        else {
            apply(msg);
        }
        onChange([...items.values()].sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "")));
    }, { type: "aurora/alarms/subscribe" });
}
function createAlarm(hass, input) {
    return hass.callWS({ type: "aurora/alarms/create", ...input });
}
function updateAlarm(hass, id, changes) {
    return hass.callWS({ type: "aurora/alarms/update", alarm_id: id, ...changes });
}
function deleteAlarm(hass, id) {
    return hass.callWS({ type: "aurora/alarms/delete", alarm_id: id });
}
function getSettings(hass) {
    return hass.callWS({ type: "aurora/settings/get" });
}
function setSettings(hass, options) {
    return hass.callWS({ type: "aurora/settings/set", options });
}
function getRoleEntities(hass) {
    return hass.callWS({ type: "aurora/options/entities" });
}
const ringAction = (hass, service) => hass.callService("aurora", service, {});
/**
 * Browse Home Assistant media. With an `entityId` the player's own tree is used
 * (richest — includes its providers and the media sources it can play); without
 * one, the installation's media sources are browsed. `contentId`/`contentType`
 * navigate into a folder; omit them for the root.
 */
function browseMedia(hass, entityId, contentId, contentType) {
    if (entityId) {
        return hass.callWS({
            type: "media_player/browse_media",
            entity_id: entityId,
            ...(contentId ? { media_content_id: contentId } : {}),
            ...(contentType ? { media_content_type: contentType } : {}),
        });
    }
    return hass.callWS({
        type: "media_source/browse_media",
        ...(contentId ? { media_content_id: contentId } : {}),
    });
}
/** Submit a selfie (data URL / base64) to the AI-vision provider for a verdict. */
function visionCheck(hass, image, alarmId) {
    return hass.callWS({
        type: "aurora/vision/check",
        image,
        alarm_id: alarmId,
    });
}

const STRINGS = {
    en: {
        // common
        "common.cancel": "Cancel",
        "common.save": "Save",
        "common.saving": "Saving…",
        "common.saved": "✓ Saved",
        "common.loading": "Loading…",
        "common.optional": "optional",
        "common.delete": "Delete",
        "common.none": "—",
        // weekdays (Mon-first); letters split by "," names by "|"
        "weekday.letters": "M,T,W,T,F,S,S",
        "weekday.names": "Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday",
        "weekday.short": "Mon,Tue,Wed,Thu,Fri,Sat,Sun",
        "schedule.title": "This week",
        "schedule.empty": "No alarms this day",
        // roles
        "role.audio_sink.label": "Speaker",
        "role.audio_sink.desc": "Where the alarm rings",
        "role.wake_light.label": "Light / screen (sunrise)",
        "role.wake_light.desc": "A light or screen for the sunrise ramp",
        "role.display_surface.label": "Display surface",
        "role.display_surface.desc": "A screen that shows the ring view",
        "role.notify_channel.label": "Notifications",
        "role.notify_channel.desc": "Where notifications arrive (phone, watch, overlay…)",
        "role.sleep_signal.label": "Sleep signals",
        "role.sleep_signal.desc": "Sensors that tell whether you are asleep (watch, mattress…)",
        "role.presence_signal.label": "Presence signals",
        "role.presence_signal.desc": "Sensors that tell whether you are present / awake",
        "role.conversation.label": "Voice agent",
        "role.conversation.desc": "Voice assistant for commands",
        "role.tts.label": "Text-to-speech",
        "role.tts.desc": "Voice for the briefing and announcements",
        "role.vision_provider.label": "Vision provider",
        "role.vision_provider.desc": "AI that judges the wake-up selfie (AI Task or LLM Vision)",
        // missions
        "mission.none": "None",
        "mission.tap": "Tap",
        "mission.math": "Math",
        "mission.qr": "QR code",
        "mission.shake": "Shake",
        "mission.open_door": "Open door",
        "mission.vision": "Selfie (AI)",
        // repeat modes
        "repeat.once": "Once",
        "repeat.daily": "Every day",
        "repeat.weekly": "Weekly",
        // schedule summary
        "summary.daily": "Every day",
        "summary.once": "Once",
        "summary.on_date": "On {date}",
        "summary.never": "Never",
        // alarm dialog
        "dialog.new_title": "New alarm",
        "dialog.edit_title": "Edit alarm",
        "dialog.label": "Label",
        "dialog.label_placeholder": "e.g. Work alarm",
        "dialog.repeat": "Repeat",
        "dialog.days": "Days",
        "dialog.mission": "Anti-snooze mission",
        "dialog.sound": "Sound",
        "dialog.sound_custom": "Custom URI…",
        "dialog.sound_uri": "Sound URI / playlist",
        "dialog.snooze_max": "Max snooze",
        "dialog.snooze_duration": "Snooze length (min)",
        "dialog.fade_in": "Rising volume (fade-in)",
        "dialog.volume": "Volume",
        "dialog.when_stops": "When it stops",
        "dialog.end_none": "Keep",
        "dialog.end_restore": "Restore",
        "dialog.end_fixed": "Set to…",
        "dialog.sunrise": "Sunrise (light/screen ramp)",
        "dialog.smart": "Smart wake",
        "dialog.smart_desc": "Ring earlier if I detect you already awake (your profile's signals)",
        "dialog.sunrise_min": "Sunrise length (min)",
        "dialog.smart_min": "Smart window (min)",
        "dialog.briefing": "Wake-up briefing",
        "dialog.briefing_desc": "Speak time, weather and agenda when you stop the alarm",
        "dialog.display": "Wake overlay (display surface)",
        "dialog.display_none": "No display surfaces bound in Setup for this profile.",
        "mparam.difficulty": "Difficulty",
        "mparam.easy": "Easy",
        "mparam.medium": "Medium",
        "mparam.hard": "Hard",
        "mparam.shake_count": "Shakes needed",
        "mparam.qr_value": "Expected QR text (optional)",
        "mparam.door_entity": "Door sensor (binary_sensor.…)",
        // briefing blocks
        "briefing.block.time": "Time & greeting",
        "briefing.block.weather": "Weather",
        "briefing.block.calendar": "Calendar",
        "briefing.block.todo": "To-dos",
        // alarm list
        "alarms.title": "Alarms",
        "alarms.new": "+ New",
        "alarms.empty": "No alarms yet — tap “+ New” to create one.",
        "alarms.default_label": "Alarm",
        "alarms.skip_badge": "skip 1",
        "alarms.skip_title": "Skip the next one",
        // dashboard card
        "card.next_alarm": "Next alarm",
        "card.no_alarm": "No alarm scheduled",
        "card.open_app": "Open the Aurora app →",
        "carded.title": "Title",
        "carded.ring_screen": "Use as ring screen",
        "carded.ring_screen_desc": "Show the fullscreen alarm view on this card when an alarm rings. Off by default — turn it on only on the device you dedicate to the alarm (e.g. a bedside tablet).",
        "carded.ring_animation": "Show ring animation in card",
        "carded.ring_animation_desc": "Play the sunrise alarm animation inside this card when an alarm rings. Off by default — enable on cards where you want an in-card wake-up visual.",
        "rel.now": "now",
        "rel.in_min": "in {n} min",
        "rel.in_hm": "in {h}h {m}m",
        "rel.in_h": "in {h}h",
        "rel.in_day": "in 1 day",
        "rel.in_days": "in {n} days",
        // panel
        "panel.all": "Everyone",
        "panel.profile": "Profile",
        "panel.tab_alarms": "Alarms",
        "panel.tab_devices": "Setup",
        "panel.tab_globals": "Shared",
        "panel.select_profile": "Select a profile to configure its devices.",
        // devices view
        "devices.loading": "Loading devices…",
        "devices.intro": "{name}'s devices — all optional. Search and add only what you need; the exact alarm time is always guaranteed.",
        "devices.this_profile": "this profile",
        "devices.save": "Save setup",
        "setup.group.audio": "Audio",
        "setup.group.wake": "Wake & display",
        "setup.group.notify": "Notifications",
        "setup.group.presence": "Presence & sleep",
        "setup.group.voice": "Voice",
        // audio presets
        "presets.title": "Audio presets",
        "presets.desc": "Reusable sounds and playlists for {name}'s alarms.",
        "presets.new": "+ New",
        "presets.empty": "No presets yet — create one to reuse it in any alarm.",
        "presets.count": "{n} items",
        "presets.edit": "Edit",
        "presets.name": "Preset name",
        "presets.no_items": "No tracks yet — browse media to add some.",
        "presets.add_media": "+ Browse media",
        "presets.save": "Save preset",
        "presets.untitled": "Untitled preset",
        "presets.playback": "Playback",
        "presets.shuffle": "Shuffle",
        "presets.loop": "Loop",
        "presets.drag": "Drag to reorder",
        // media browser
        "browser.title": "Choose media",
        "browser.root": "Library",
        "browser.empty": "Nothing here.",
        "browser.paste": "Paste a media URI",
        "browser.paste_add": "Add",
        "browser.add_selected": "Add {n}",
        // globals view
        "globals.intro": "Settings shared across the whole installation.",
        "globals.ring_max": "Max ring duration (min)",
        "globals.skip_calendars": "Skip-day calendars",
        "globals.holiday_calendars": "Holiday calendars (auto-skip)",
        "globals.briefing_intro": "Wake-up briefing — sources read when an alarm has the briefing on. Empty = auto-detect.",
        "globals.weather": "Weather (weather entity)",
        "globals.briefing_calendars": "Briefing calendars",
        "globals.todo_lists": "To-do lists",
        "globals.vision_intro": "Selfie wake check (AI vision) — the optional anti-snooze mission that confirms you are up. Aurora works with two providers: bind a Home Assistant AI Task entity, or install LLM Vision (auto-detected if no AI Task is set).",
        "globals.vision_provider": "AI Task vision entity",
        "globals.vision_active_aitask": "Active: {name} (Home Assistant AI Task).",
        "globals.vision_active_llm": "No AI Task bound — using LLM Vision (auto-detected): {names}.",
        "globals.vision_active_none": "No vision provider available — the selfie mission falls back to the math challenge. Bind an AI Task entity or install LLM Vision.",
        "globals.vision_ref_aitask": "Home Assistant AI Tasks",
        "globals.vision_ref_llm": "LLM Vision integration",
        "globals.save": "Save shared settings",
        // entity picker
        "picker.none": "No compatible entity found.",
        "picker.empty_option": "— None —",
        "picker.add": "＋ Add…",
        // ring overlay
        "ring.label": "Time to get up",
        "ring.snooze": "Snooze",
        "ring.stop": "Stop",
        "ring.start_mission": "I'm awake",
        // mission overlay
        "missionui.math_prompt": "Solve to dismiss",
        "missionui.answer": "Answer",
        "missionui.check": "Check",
        "missionui.wrong": "Wrong — try again",
        "missionui.shake_prompt": "Shake to dismiss",
        "missionui.shake_enable": "Enable motion",
        "missionui.qr_prompt": "Scan the QR code to dismiss",
        "missionui.nocam": "Camera unavailable — switching challenge",
        "missionui.opendoor_prompt": "Open {name} to dismiss",
        "missionui.door": "the door",
        "missionui.vision_prompt": "Take a selfie to prove you're up",
        "missionui.capture": "Capture",
        "missionui.checking": "Checking…",
        "missionui.vision_failed": "Couldn't verify — try again",
        "missionui.degraded": "Switched to a simpler challenge",
        "missionui.back": "Back",
    },
    it: {
        "common.cancel": "Annulla",
        "common.save": "Salva",
        "common.saving": "Salvataggio…",
        "common.saved": "✓ Salvato",
        "common.loading": "Caricamento…",
        "common.optional": "opzionale",
        "common.delete": "Elimina",
        "common.none": "—",
        "weekday.letters": "L,M,M,G,V,S,D",
        "weekday.names": "Lunedì|Martedì|Mercoledì|Giovedì|Venerdì|Sabato|Domenica",
        "weekday.short": "Lun,Mar,Mer,Gio,Ven,Sab,Dom",
        "schedule.title": "Questa settimana",
        "schedule.empty": "Nessuna sveglia questo giorno",
        "role.audio_sink.label": "Altoparlante",
        "role.audio_sink.desc": "Dove suona la sveglia",
        "role.wake_light.label": "Luce / schermo (alba)",
        "role.wake_light.desc": "Luce o schermo per la rampa alba",
        "role.display_surface.label": "Superficie display",
        "role.display_surface.desc": "Schermo che mostra la schermata sveglia",
        "role.notify_channel.label": "Notifiche",
        "role.notify_channel.desc": "Dove arrivano le notifiche (telefono, watch, overlay…)",
        "role.sleep_signal.label": "Segnali di sonno",
        "role.sleep_signal.desc": "Sensori che capiscono se stai dormendo (watch, materasso…)",
        "role.presence_signal.label": "Segnali di presenza",
        "role.presence_signal.desc": "Sensori che capiscono se sei presente / sveglio",
        "role.conversation.label": "Agente vocale",
        "role.conversation.desc": "Assistente vocale per i comandi",
        "role.tts.label": "Sintesi vocale",
        "role.tts.desc": "Voce per briefing e annunci",
        "role.vision_provider.label": "Provider di visione",
        "role.vision_provider.desc": "IA che valuta il selfie del risveglio (AI Task o LLM Vision)",
        "mission.none": "Nessuna",
        "mission.tap": "Tocco",
        "mission.math": "Matematica",
        "mission.qr": "Codice QR",
        "mission.shake": "Scuoti",
        "mission.open_door": "Apri porta",
        "mission.vision": "Selfie (AI)",
        "repeat.once": "Una volta",
        "repeat.daily": "Ogni giorno",
        "repeat.weekly": "Settimanale",
        "summary.daily": "Ogni giorno",
        "summary.once": "Una volta",
        "summary.on_date": "Il {date}",
        "summary.never": "Mai",
        "dialog.new_title": "Nuova sveglia",
        "dialog.edit_title": "Modifica sveglia",
        "dialog.label": "Etichetta",
        "dialog.label_placeholder": "Es. Sveglia lavoro",
        "dialog.repeat": "Ripetizione",
        "dialog.days": "Giorni",
        "dialog.mission": "Missione anti-snooze",
        "dialog.sound": "Suono",
        "dialog.sound_custom": "URI personalizzato…",
        "dialog.sound_uri": "URI suono / playlist",
        "dialog.snooze_max": "Max snooze",
        "dialog.snooze_duration": "Durata snooze (min)",
        "dialog.fade_in": "Volume crescente (fade-in)",
        "dialog.volume": "Volume",
        "dialog.when_stops": "Quando si ferma",
        "dialog.end_none": "Invariato",
        "dialog.end_restore": "Ripristina",
        "dialog.end_fixed": "Imposta…",
        "dialog.sunrise": "Alba (rampa luce/schermo)",
        "dialog.smart": "Risveglio intelligente",
        "dialog.smart_desc": "Suona prima se ti rilevo già sveglio (segnali del tuo profilo)",
        "dialog.sunrise_min": "Durata alba (min)",
        "dialog.smart_min": "Finestra anticipo (min)",
        "dialog.briefing": "Briefing al risveglio",
        "dialog.briefing_desc": "Pronuncia ora, meteo e impegni quando fermi la sveglia",
        "dialog.display": "Overlay risveglio (superficie display)",
        "dialog.display_none": "Nessuna superficie display associata nel Setup per questo profilo.",
        "mparam.difficulty": "Difficoltà",
        "mparam.easy": "Facile",
        "mparam.medium": "Media",
        "mparam.hard": "Difficile",
        "mparam.shake_count": "Scuotimenti richiesti",
        "mparam.qr_value": "Testo QR atteso (opzionale)",
        "mparam.door_entity": "Sensore porta (binary_sensor.…)",
        "briefing.block.time": "Ora e saluto",
        "briefing.block.weather": "Meteo",
        "briefing.block.calendar": "Calendario",
        "briefing.block.todo": "Cose da fare",
        "alarms.title": "Sveglie",
        "alarms.new": "+ Nuova",
        "alarms.empty": "Nessuna sveglia — tocca “+ Nuova” per crearne una.",
        "alarms.default_label": "Sveglia",
        "alarms.skip_badge": "salta 1",
        "alarms.skip_title": "Salta la prossima",
        "card.next_alarm": "Prossima sveglia",
        "card.no_alarm": "Nessuna sveglia programmata",
        "card.open_app": "Apri l'app Aurora →",
        "carded.title": "Titolo",
        "carded.ring_screen": "Usa come schermo sveglia",
        "carded.ring_screen_desc": "Mostra la schermata sveglia a tutto schermo su questa card quando suona. Disattivato di default — attivalo solo sul dispositivo che dedichi alla sveglia (es. un tablet sul comodino).",
        "carded.ring_animation": "Mostra animazione sveglia nella card",
        "carded.ring_animation_desc": "Avvia l'animazione alba nella card quando suona una sveglia. Disattivato di default — abilitalo nelle card dove vuoi un visuale di risveglio integrato.",
        "rel.now": "ora",
        "rel.in_min": "tra {n} min",
        "rel.in_hm": "tra {h}h {m}m",
        "rel.in_h": "tra {h}h",
        "rel.in_day": "tra 1 giorno",
        "rel.in_days": "tra {n} giorni",
        "panel.all": "Tutti",
        "panel.profile": "Profilo",
        "panel.tab_alarms": "Sveglie",
        "panel.tab_devices": "Setup",
        "panel.tab_globals": "Globali",
        "panel.select_profile": "Seleziona un profilo per configurarne i dispositivi.",
        "devices.loading": "Caricamento dispositivi…",
        "devices.intro": "Dispositivi di {name} — tutto opzionale. Cerca e aggiungi solo ciò che ti serve; l'orario esatto è sempre garantito.",
        "devices.this_profile": "questo profilo",
        "devices.save": "Salva setup",
        "setup.group.audio": "Audio",
        "setup.group.wake": "Risveglio & display",
        "setup.group.notify": "Notifiche",
        "setup.group.presence": "Presenza & sonno",
        "setup.group.voice": "Voce",
        "presets.title": "Preset audio",
        "presets.desc": "Suoni e playlist riutilizzabili per le sveglie di {name}.",
        "presets.new": "+ Nuovo",
        "presets.empty": "Ancora nessun preset — creane uno per riusarlo in ogni sveglia.",
        "presets.count": "{n} elementi",
        "presets.edit": "Modifica",
        "presets.name": "Nome preset",
        "presets.no_items": "Nessun brano — sfoglia i media per aggiungerne.",
        "presets.add_media": "+ Sfoglia media",
        "presets.save": "Salva preset",
        "presets.untitled": "Preset senza nome",
        "presets.playback": "Riproduzione",
        "presets.shuffle": "Casuale",
        "presets.loop": "Ripeti",
        "presets.drag": "Trascina per riordinare",
        "browser.title": "Scegli media",
        "browser.root": "Libreria",
        "browser.empty": "Niente qui.",
        "browser.paste": "Incolla un URI media",
        "browser.paste_add": "Aggiungi",
        "browser.add_selected": "Aggiungi {n}",
        "globals.intro": "Impostazioni condivise da tutta l'installazione.",
        "globals.ring_max": "Durata massima suoneria (min)",
        "globals.skip_calendars": "Calendari per salto impegni",
        "globals.holiday_calendars": "Calendari festività (auto-skip)",
        "globals.briefing_intro": "Briefing del risveglio — sorgenti lette quando la sveglia ha il briefing attivo. Vuoto = rilevamento automatico.",
        "globals.weather": "Meteo (entità weather)",
        "globals.briefing_calendars": "Calendari del briefing",
        "globals.todo_lists": "Liste di cose da fare",
        "globals.vision_intro": "Verifica del risveglio con selfie (visione IA) — la missione anti-snooze opzionale che conferma che sei sveglio. Aurora funziona con due provider: collega un'entità AI Task di Home Assistant, oppure installa LLM Vision (rilevato in automatico se non imposti un'AI Task).",
        "globals.vision_provider": "Entità di visione AI Task",
        "globals.vision_active_aitask": "Attivo: {name} (AI Task di Home Assistant).",
        "globals.vision_active_llm": "Nessuna AI Task collegata — uso LLM Vision (rilevato): {names}.",
        "globals.vision_active_none": "Nessun provider di visione disponibile — la missione selfie ripiega sulla sfida matematica. Collega un'entità AI Task o installa LLM Vision.",
        "globals.vision_ref_aitask": "AI Task di Home Assistant",
        "globals.vision_ref_llm": "Integrazione LLM Vision",
        "globals.save": "Salva globali",
        "picker.none": "Nessuna entità compatibile trovata.",
        "picker.empty_option": "— Nessuno —",
        "picker.add": "＋ Aggiungi…",
        "ring.label": "È ora di alzarsi",
        "ring.snooze": "Posponi",
        "ring.stop": "Stop",
        "ring.start_mission": "Sono sveglio",
        "missionui.math_prompt": "Risolvi per spegnere",
        "missionui.answer": "Risposta",
        "missionui.check": "Verifica",
        "missionui.wrong": "Sbagliato — riprova",
        "missionui.shake_prompt": "Scuoti per spegnere",
        "missionui.shake_enable": "Abilita movimento",
        "missionui.qr_prompt": "Inquadra il QR per spegnere",
        "missionui.nocam": "Fotocamera non disponibile — cambio sfida",
        "missionui.opendoor_prompt": "Apri {name} per spegnere",
        "missionui.door": "la porta",
        "missionui.vision_prompt": "Scatta un selfie per dimostrare che sei sveglio",
        "missionui.capture": "Scatta",
        "missionui.checking": "Verifica…",
        "missionui.vision_failed": "Non verificato — riprova",
        "missionui.degraded": "Passato a una sfida più semplice",
        "missionui.back": "Indietro",
    },
};

/**
 * Tiny runtime localizer for the Aurora card. English is the default; any
 * language with a bucket in translations.ts is used when it matches
 * `hass.language` (exact, e.g. "it", or base of "it-IT"), otherwise English.
 * Missing keys fall back to English, then to the raw key.
 */
function pickLang(language) {
    if (!language)
        return "en";
    const lower = language.toLowerCase();
    if (lower in STRINGS)
        return lower;
    const base = lower.split("-")[0];
    return (base in STRINGS ? base : "en");
}
/** Translate `key` for the user's language, interpolating `{var}` placeholders. */
function localize(language, key, vars) {
    const lang = pickLang(language);
    let out = STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
    if (vars) {
        for (const [name, value] of Object.entries(vars)) {
            out = out.replaceAll(`{${name}}`, String(value));
        }
    }
    return out;
}
/** Localized weekday initials (Mon-first), e.g. ["M","T","W","T","F","S","S"]. */
function weekdayLetters(language) {
    return localize(language, "weekday.letters").split(",");
}

/**
 * Shared "Dawn" design tokens + primitives. Base colours come from the user's
 * Home Assistant theme (CSS variables) so Aurora always feels native in light or
 * dark; the signature sunrise gradient is the one bold, memorable accent.
 */
const auroraStyles = i$3 `
  :host {
    /* Signature "Dawn" sunrise — reserved for brand/hero moments (title, card
       hero, ring overlay, avatar). Everything interactive follows the HA theme. */
    --aurora-grad: linear-gradient(135deg, #232554 0%, #5b3f9d 44%, #e89a4b 100%);
    --aurora-accent: var(--primary-color, #6d4aa7);
    /* Interactive accent derived from the active theme's primary colour so
       toggles/chips/buttons feel native in any light or dark HA theme. */
    --aurora-accent-grad: linear-gradient(
      135deg,
      color-mix(in srgb, var(--aurora-accent) 90%, #fff),
      color-mix(in srgb, var(--aurora-accent) 76%, #000)
    );
    /* Readable text/icon colour ON an accent fill (the theme's "on-primary"). */
    --aurora-on-accent: var(--text-primary-color, #fff);
    --aurora-grad-soft: linear-gradient(
      135deg,
      color-mix(in srgb, var(--aurora-accent) 16%, transparent),
      color-mix(in srgb, var(--aurora-accent) 8%, transparent)
    );
    --aurora-text: var(--primary-text-color, #1b1b27);
    --aurora-dim: var(--secondary-text-color, #6c6c82);
    --aurora-surface: var(--card-background-color, var(--ha-card-background, #fff));
    --aurora-divider: var(--divider-color, rgba(120, 120, 140, 0.16));
    --aurora-danger: var(--error-color, #d8455f);
    --aurora-radius: 20px;
    --aurora-radius-sm: 13px;
    --aurora-shadow: 0 10px 30px -16px rgba(35, 37, 84, 0.5);
    color: var(--aurora-text);
    font-family: var(--paper-font-body1_-_font-family, "Roboto", system-ui, sans-serif);
  }
  * {
    box-sizing: border-box;
  }
  .grad-text {
    background: var(--aurora-grad);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .clock {
    font-variant-numeric: tabular-nums;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 0.95;
  }
  .muted {
    color: var(--aurora-dim);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .spacer {
    flex: 1;
  }
  /* Buttons */
  .btn {
    appearance: none;
    border: none;
    cursor: pointer;
    font: inherit;
    font-weight: 600;
    border-radius: 999px;
    padding: 10px 18px;
    color: var(--aurora-text);
    background: color-mix(in srgb, var(--aurora-accent) 12%, transparent);
    transition: transform 0.12s ease, background 0.2s ease, box-shadow 0.2s ease;
  }
  .btn:hover {
    background: color-mix(in srgb, var(--aurora-accent) 20%, transparent);
  }
  .btn:active {
    transform: scale(0.96);
  }
  .btn.primary {
    color: var(--aurora-on-accent);
    background: var(--aurora-accent-grad);
    box-shadow: var(--aurora-shadow);
  }
  .btn.ghost {
    background: transparent;
  }
  .btn.danger {
    color: var(--aurora-danger);
    background: color-mix(in srgb, var(--aurora-danger) 12%, transparent);
  }
  .icon-btn {
    appearance: none;
    border: none;
    cursor: pointer;
    background: transparent;
    color: var(--aurora-dim);
    width: 38px;
    height: 38px;
    border-radius: 50%;
    display: inline-grid;
    place-items: center;
    font-size: 18px;
    transition: background 0.18s ease, color 0.18s ease;
  }
  .icon-btn:hover {
    background: color-mix(in srgb, var(--aurora-accent) 14%, transparent);
    color: var(--aurora-text);
  }
  /* Inputs */
  input[type="time"],
  input[type="text"],
  input[type="number"],
  select {
    font: inherit;
    color: var(--aurora-text);
    /* Solid theme fill (a faint near-transparent fill makes native selects fall
       back to the unstyled OS widget on many platforms). */
    background: color-mix(in srgb, var(--aurora-text) 5%, var(--aurora-surface));
    border: 1px solid var(--aurora-divider);
    border-radius: var(--aurora-radius-sm);
    padding: 10px 12px;
    width: 100%;
  }
  /* Native <select> ignores the theme unless the OS appearance is stripped; then
     we draw our own chevron and theme the option popup so all dropdowns match. */
  select {
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    cursor: pointer;
    padding-right: 38px;
    background-image: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='14'%20height='14'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='%23888fa3'%20stroke-width='2.6'%20stroke-linecap='round'%20stroke-linejoin='round'%3E%3Cpath%20d='M6%209l6%206%206-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 13px center;
    background-size: 14px;
  }
  select option,
  select optgroup {
    background: var(--aurora-surface);
    color: var(--aurora-text);
  }
  input:focus,
  select:focus,
  select:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--aurora-accent) 55%, transparent);
    outline-offset: 1px;
    border-color: color-mix(in srgb, var(--aurora-accent) 45%, var(--aurora-divider));
  }
  label.field {
    display: block;
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--aurora-dim);
    margin: 0 0 6px 2px;
  }
  /* Toggle switch */
  .switch {
    position: relative;
    width: 46px;
    height: 27px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--aurora-dim) 32%, transparent);
    cursor: pointer;
    transition: background 0.22s ease;
    flex: none;
  }
  .switch[aria-checked="true"] {
    background: var(--aurora-accent-grad);
  }
  .switch::after {
    content: "";
    position: absolute;
    top: 3px;
    left: 3px;
    width: 21px;
    height: 21px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: transform 0.22s cubic-bezier(0.3, 1.3, 0.6, 1);
  }
  .switch[aria-checked="true"]::after {
    transform: translateX(19px);
  }
`;

let AuroraWeekdayChips = class AuroraWeekdayChips extends i {
    constructor() {
        super(...arguments);
        this.value = [];
    }
    _toggle(day) {
        const set = new Set(this.value);
        if (set.has(day)) {
            set.delete(day);
        }
        else {
            set.add(day);
        }
        this.value = [...set].sort((a, b) => a - b);
        this.dispatchEvent(new CustomEvent("change", { detail: this.value }));
    }
    render() {
        return b `
      <div class="chips">
        ${weekdayLetters(this.language).map((letter, i) => b `
            <button
              type="button"
              class="chip ${this.value.includes(i) ? "on" : ""}"
              @click=${() => this._toggle(i)}
            >
              ${letter}
            </button>
          `)}
      </div>
    `;
    }
};
AuroraWeekdayChips.styles = [
    auroraStyles,
    i$3 `
      .chips {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .chip {
        appearance: none;
        border: none;
        cursor: pointer;
        font: inherit;
        font-weight: 700;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        color: var(--aurora-dim);
        background: color-mix(in srgb, var(--aurora-dim) 10%, transparent);
        transition: transform 0.12s ease, background 0.2s ease, color 0.2s ease;
      }
      .chip:active {
        transform: scale(0.9);
      }
      .chip.on {
        color: var(--aurora-on-accent);
        background: var(--aurora-accent-grad);
        box-shadow: var(--aurora-shadow);
      }
    `,
];
__decorate([
    n({ attribute: false })
], AuroraWeekdayChips.prototype, "value", void 0);
__decorate([
    n({ attribute: false })
], AuroraWeekdayChips.prototype, "language", void 0);
AuroraWeekdayChips = __decorate([
    t("aurora-weekday-chips")
], AuroraWeekdayChips);

/** Wake-up briefing block keys (labels localized via "briefing.block.<key>"). */
const BRIEFING_BLOCKS = ["time", "weather", "calendar", "todo"];
// Mission types in display order. Labels are localized via "mission.<type>".
const MISSION_TYPES = [
    "none",
    "tap",
    "math",
    "qr",
    "shake",
    "open_door",
    "vision",
];

const VOLUME_END_MODES = ["none", "restore", "fixed"];
// Sentinel option values for the sound picker.
const PRESET_PREFIX = "aurora_preset:";
const SOUND_CUSTOM = "__custom__";
const REPEATS = ["once", "daily", "weekly"];
// mdi:close — inlined so the bundle needs no mdi import.
const MDI_CLOSE = "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z";
let AuroraAlarmDialog = class AuroraAlarmDialog extends i {
    constructor() {
        super(...arguments);
        this.alarm = null;
        this.profileId = null;
        this.open = false;
        this._time = "07:00";
        this._label = "";
        this._repeat = "daily";
        this._days = [0, 1, 2, 3, 4];
        this._mission = "tap";
        this._missionParams = {};
        this._snoozeMax = 3;
        this._snoozeMin = 9;
        this._audioSource = "";
        this._audioCustom = false;
        this._presets = [];
        this._audioFade = true;
        this._volume = 70;
        this._volEndMode = "none";
        this._volEnd = 30;
        this._light = false;
        this._lightMin = 30;
        this._smart = false;
        this._smartMin = 30;
        this._briefing = false;
        this._briefingBlocks = [...BRIEFING_BLOCKS];
        this._enabled = true;
        this._saving = false;
        this._display = false;
        this._displayTargets = [];
        this._displayOptions = [];
    }
    willUpdate(changed) {
        if (changed.has("open") && this.open) {
            this._populate();
            void this._loadPresets();
        }
    }
    async _loadPresets() {
        const pid = this.alarm?.profile_id ?? this.profileId;
        if (!pid) {
            this._presets = [];
            this._displayOptions = [];
            return;
        }
        try {
            const settings = await getSettings(this.hass);
            const profiles = settings.options.profiles ?? {};
            this._presets = profiles[pid]?.audio_presets ?? [];
            const bindings = profiles[pid]?.bindings;
            const bound = bindings?.["display_surface"];
            this._displayOptions = Array.isArray(bound) ? bound : bound ? [String(bound)] : [];
        }
        catch {
            this._presets = [];
            this._displayOptions = [];
        }
    }
    _populate() {
        const a = this.alarm;
        this._time = a?.time ?? "07:00";
        this._label = a?.label ?? "";
        this._repeat = a?.schedule.repeat_mode ?? "daily";
        this._days = a?.schedule.weekdays?.length ? [...a.schedule.weekdays] : [0, 1, 2, 3, 4];
        this._mission = a?.features.mission.type ?? "tap";
        this._missionParams = { ...(a?.features.mission.params ?? {}) };
        this._snoozeMax = a?.features.snooze.max ?? 3;
        this._snoozeMin = a ? Math.round((a.features.snooze.duration ?? 540) / 60) : 9;
        this._audioSource = a?.features.audio.source ?? "";
        // A raw (non-preset) source means the user typed a custom URI/playlist.
        this._audioCustom =
            this._audioSource !== "" && !this._audioSource.startsWith(PRESET_PREFIX);
        this._audioFade = a ? a.features.audio.volume_profile === "fade_in" : true;
        this._volume = Math.round((a?.features.audio.volume_max ?? 0.7) * 100);
        this._volEndMode = a?.features.audio.volume_end_mode ?? "none";
        this._volEnd =
            a?.features.audio.volume_end != null
                ? Math.round(a.features.audio.volume_end * 100)
                : 30;
        this._light = a?.features.light.enabled ?? false;
        this._lightMin = a?.features.light.duration_min ?? 30;
        this._smart = a?.features.smart_window.enabled ?? false;
        this._smartMin = a?.features.smart_window.minutes ?? 30;
        this._briefing = a?.features.briefing.enabled ?? false;
        this._briefingBlocks = a?.features.briefing.blocks?.length
            ? [...a.features.briefing.blocks]
            : [...BRIEFING_BLOCKS];
        this._display = a?.features.display?.enabled ?? false;
        this._displayTargets = [...(a?.features.display?.targets ?? [])];
        this._enabled = a?.enabled ?? true;
        this._saving = false;
    }
    _close() {
        if (!this.open) {
            return;
        }
        this.open = false;
        this.dispatchEvent(new CustomEvent("closed"));
    }
    // The dialog is a WebAwesome `wa-dialog` under the hood: a scrim/Escape/X
    // dismissal surfaces as a `wa-hide` event. Inner controls (the mission
    // dropdown, etc.) can emit their own `wa-hide`; ignore those — only act when
    // the event retargets to the dialog host itself.
    _onDialogHide(e) {
        if (e.target !== e.currentTarget) {
            return;
        }
        this._close();
    }
    _toggleBlock(block) {
        this._briefingBlocks = this._briefingBlocks.includes(block)
            ? this._briefingBlocks.filter((b) => b !== block)
            : [...this._briefingBlocks, block];
    }
    _setParam(key, value) {
        this._missionParams = { ...this._missionParams, [key]: value };
    }
    // Wrap HA's stable `ha-selector` — it self-loads the right input for the
    // running HA version (today the WebAwesome `wa-input`/`ha-select`), so the
    // editor stays correct across the frontend's component migrations.
    _selector(selector, label, value, onChange, cls = "block") {
        return b `<ha-selector
      class=${cls}
      .hass=${this.hass}
      .selector=${selector}
      .label=${label}
      .value=${value ?? ""}
      .required=${false}
      @value-changed=${(e) => onChange(e.detail.value)}
    ></ha-selector>`;
    }
    _missionParamsBlock() {
        const lang = this.hass?.language;
        const p = this._missionParams;
        if (this._mission === "math") {
            const cur = String(p["difficulty"] ?? "medium");
            return b `<div class="block">
        <label class="field">${localize(lang, "mparam.difficulty")}</label>
        <div class="seg">
          ${["easy", "medium", "hard"].map((d) => b `<button
              class=${cur === d ? "on" : ""}
              @click=${() => this._setParam("difficulty", d)}
            >
              ${localize(lang, "mparam." + d)}
            </button>`)}
        </div>
      </div>`;
        }
        if (this._mission === "shake") {
            return this._selector({ number: { min: 3, max: 50, step: 1, mode: "box" } }, localize(lang, "mparam.shake_count"), Number(p["count"] ?? 12), (v) => this._setParam("count", Number(v ?? 0)));
        }
        if (this._mission === "qr") {
            return this._selector({ text: {} }, localize(lang, "mparam.qr_value"), String(p["value"] ?? ""), (v) => this._setParam("value", v ?? ""));
        }
        if (this._mission === "open_door") {
            return this._selector({ entity: { filter: [{ domain: "binary_sensor" }] } }, localize(lang, "mparam.door_entity"), String(p["entity_id"] ?? ""), (v) => this._setParam("entity_id", v ?? ""));
        }
        return A;
    }
    // The sound is either one of the profile's saved audio presets or a custom
    // URI/playlist. With no presets we keep the plain text field (back-compat).
    _soundField(lang) {
        if (!this._presets.length) {
            return this._selector({ text: {} }, localize(lang, "dialog.sound"), this._audioSource, (v) => (this._audioSource = v ?? ""), "");
        }
        const isPreset = this._audioSource.startsWith(PRESET_PREFIX);
        const value = this._audioCustom ? SOUND_CUSTOM : isPreset ? this._audioSource : "";
        const options = [
            { value: "", label: localize(lang, "picker.empty_option") },
            ...this._presets.map((p) => ({ value: PRESET_PREFIX + p.id, label: "🎵 " + p.name })),
            { value: SOUND_CUSTOM, label: localize(lang, "dialog.sound_custom") },
        ];
        return b `<div class="soundwrap">
      ${this._selector({ select: { mode: "dropdown", options } }, localize(lang, "dialog.sound"), value, (v) => this._onSoundSelect(v ?? ""), "")}
      ${this._audioCustom
            ? this._selector({ text: {} }, localize(lang, "dialog.sound_uri"), this._audioSource.startsWith(PRESET_PREFIX) ? "" : this._audioSource, (v) => (this._audioSource = v ?? ""), "")
            : A}
    </div>`;
    }
    // Ring volume + what to do with the speaker volume once the alarm stops.
    _volumeBlock(lang) {
        return b `
      <div class="block">
        <label class="field">${localize(lang, "dialog.volume")}</label>
        <div class="sliderrow">
          <ha-icon icon="mdi:volume-high"></ha-icon>
          ${this._slider(this._volume, (v) => (this._volume = v))}
          <span class="pct">${this._volume}%</span>
        </div>
      </div>
      <div class="block">
        <label class="field">${localize(lang, "dialog.when_stops")}</label>
        <div class="seg">
          ${VOLUME_END_MODES.map((m) => b `<button
              class=${this._volEndMode === m ? "on" : ""}
              @click=${() => (this._volEndMode = m)}
            >
              ${localize(lang, "dialog.end_" + m)}
            </button>`)}
        </div>
        ${this._volEndMode === "fixed"
            ? b `<div class="sliderrow">
              <ha-icon icon="mdi:volume-medium"></ha-icon>
              ${this._slider(this._volEnd, (v) => (this._volEnd = v))}
              <span class="pct">${this._volEnd}%</span>
            </div>`
            : A}
      </div>
    `;
    }
    _displayBlock(lang) {
        return b `
      <div class="togglerow">
        <ha-switch
          .checked=${this._display}
          @change=${(e) => (this._display = e.target.checked)}
        ></ha-switch>
        <div class="spacer">${localize(lang, "dialog.display")}</div>
      </div>
      ${this._display
            ? this._displayOptions.length
                ? b `<ha-selector
              .hass=${this.hass}
              .selector=${{
                    select: {
                        multiple: true,
                        options: this._displayOptions.map((id) => ({
                            value: id,
                            label: this.hass.states[id]?.attributes.friendly_name ?? id,
                        })),
                    },
                }}
              .value=${this._displayTargets}
              @value-changed=${(e) => (this._displayTargets = e.detail.value)}
            ></ha-selector>`
                : b `<div class="hint">${localize(lang, "dialog.display_none")}</div>`
            : A}
    `;
    }
    _slider(value, onChange) {
        return b `<ha-selector
      .hass=${this.hass}
      .selector=${{ number: { min: 0, max: 100, step: 1, mode: "slider" } }}
      .value=${value}
      @value-changed=${(e) => onChange(Number(e.detail.value ?? 0))}
    ></ha-selector>`;
    }
    _onSoundSelect(value) {
        if (value === SOUND_CUSTOM) {
            this._audioCustom = true;
            if (this._audioSource.startsWith(PRESET_PREFIX)) {
                this._audioSource = "";
            }
            return;
        }
        this._audioCustom = false;
        this._audioSource = value;
    }
    async _save() {
        this._saving = true;
        // The backend replaces the whole `features` dict on update, so we spread the
        // existing alarm's features (and each sub-object) to preserve fields this
        // dialog does not edit — per-alarm target overrides, mission params/vision
        // prompt, smart-window signals, the briefing template, etc.
        const prev = this.alarm?.features;
        const input = {
            time: this._time,
            label: this._label,
            profile_id: this.alarm?.profile_id ?? this.profileId,
            enabled: this._enabled,
            schedule: { ...this.alarm?.schedule, repeat_mode: this._repeat, weekdays: this._days },
            features: {
                ...prev,
                mission: { ...prev?.mission, type: this._mission, params: this._missionParams },
                snooze: { ...prev?.snooze, max: this._snoozeMax, duration: this._snoozeMin * 60 },
                audio: {
                    ...prev?.audio,
                    enabled: this._audioSource !== "",
                    source: this._audioSource || null,
                    volume_profile: this._audioFade ? "fade_in" : "fixed",
                    volume_max: this._volume / 100,
                    volume_end_mode: this._volEndMode,
                    volume_end: this._volEndMode === "fixed" ? this._volEnd / 100 : null,
                },
                light: { ...prev?.light, enabled: this._light, duration_min: this._lightMin },
                smart_window: { ...prev?.smart_window, enabled: this._smart, minutes: this._smartMin },
                briefing: {
                    ...prev?.briefing,
                    enabled: this._briefing,
                    blocks: this._briefing
                        ? BRIEFING_BLOCKS.filter((b) => this._briefingBlocks.includes(b))
                        : [],
                },
                display: {
                    ...prev?.display,
                    enabled: this._display,
                    targets: this._display ? this._displayTargets : [],
                },
            },
        };
        try {
            if (this.alarm) {
                await updateAlarm(this.hass, this.alarm.id, input);
            }
            else {
                await createAlarm(this.hass, input);
            }
            this._close();
        }
        catch (err) {
            this._saving = false;
            this.dispatchEvent(new CustomEvent("error", { detail: String(err), bubbles: true, composed: true }));
        }
    }
    render() {
        if (!this.open) {
            return A;
        }
        const lang = this.hass?.language;
        const title = this.alarm
            ? localize(lang, "dialog.edit_title")
            : localize(lang, "dialog.new_title");
        return b `
      <ha-dialog open @wa-hide=${this._onDialogHide}>
        <ha-icon-button
          slot="headerNavigationIcon"
          .label=${localize(lang, "common.cancel")}
          .path=${MDI_CLOSE}
          @click=${this._close}
        ></ha-icon-button>
        <span slot="headerTitle" class="dlg-title">${title}</span>

        <input
          class="big-time clock"
          type="time"
          .value=${this._time}
          @input=${(e) => (this._time = e.target.value)}
        />

        ${this._selector({ text: {} }, localize(lang, "dialog.label"), this._label, (v) => (this._label = v ?? ""))}

        <div class="block">
          <label class="field">${localize(lang, "dialog.repeat")}</label>
          <div class="seg">
            ${REPEATS.map((r) => b `
                <button class=${this._repeat === r ? "on" : ""} @click=${() => (this._repeat = r)}>
                  ${localize(lang, "repeat." + r)}
                </button>
              `)}
          </div>
        </div>

        ${this._repeat === "weekly"
            ? b `<div class="block">
              <label class="field">${localize(lang, "dialog.days")}</label>
              <aurora-weekday-chips
                .value=${this._days}
                .language=${lang}
                @change=${(e) => (this._days = e.detail)}
              ></aurora-weekday-chips>
            </div>`
            : A}

        <div class="block grid2">
          ${this._selector({
            select: {
                mode: "dropdown",
                options: MISSION_TYPES.map((m) => ({
                    value: m,
                    label: localize(lang, "mission." + m),
                })),
            },
        }, localize(lang, "dialog.mission"), this._mission, (v) => (this._mission = v ?? "tap"), "")}
          ${this._soundField(lang)}
        </div>

        ${this._missionParamsBlock()}

        <div class="block grid2">
          ${this._selector({ number: { min: 0, max: 10, step: 1, mode: "box" } }, localize(lang, "dialog.snooze_max"), this._snoozeMax, (v) => (this._snoozeMax = Number(v ?? 0)), "")}
          ${this._selector({ number: { min: 1, max: 60, step: 1, mode: "box" } }, localize(lang, "dialog.snooze_duration"), this._snoozeMin, (v) => (this._snoozeMin = Number(v ?? 0)), "")}
        </div>

        <div class="togglerow">
          <ha-switch
            .checked=${this._audioFade}
            @change=${(e) => (this._audioFade = e.target.checked)}
          ></ha-switch>
          <div class="spacer">${localize(lang, "dialog.fade_in")}</div>
        </div>

        ${this._volumeBlock(lang)}
        ${this._displayBlock(lang)}

        <div class="togglerow">
          <ha-switch
            .checked=${this._light}
            @change=${(e) => (this._light = e.target.checked)}
          ></ha-switch>
          <div class="spacer">${localize(lang, "dialog.sunrise")}</div>
        </div>
        ${this._light
            ? this._selector({ number: { min: 1, max: 60, step: 1, mode: "box" } }, localize(lang, "dialog.sunrise_min"), this._lightMin, (v) => (this._lightMin = Number(v ?? 0)))
            : A}

        <div class="togglerow">
          <ha-switch
            .checked=${this._smart}
            @change=${(e) => (this._smart = e.target.checked)}
          ></ha-switch>
          <div class="spacer">
            ${localize(lang, "dialog.smart")}
            <div class="sub">${localize(lang, "dialog.smart_desc")}</div>
          </div>
        </div>
        ${this._smart
            ? this._selector({ number: { min: 5, max: 60, step: 1, mode: "box" } }, localize(lang, "dialog.smart_min"), this._smartMin, (v) => (this._smartMin = Number(v ?? 0)))
            : A}

        <div class="togglerow">
          <ha-switch
            .checked=${this._briefing}
            @change=${(e) => (this._briefing = e.target.checked)}
          ></ha-switch>
          <div class="spacer">
            ${localize(lang, "dialog.briefing")}
            <div class="sub">${localize(lang, "dialog.briefing_desc")}</div>
          </div>
        </div>
        ${this._briefing
            ? b `<div class="chips">
              ${BRIEFING_BLOCKS.map((b$1) => b `<button
                  class=${this._briefingBlocks.includes(b$1) ? "on" : ""}
                  @click=${() => this._toggleBlock(b$1)}
                >
                  ${localize(lang, "briefing.block." + b$1)}
                </button>`)}
            </div>`
            : A}

        <div class="footer-actions" slot="footer">
          <ha-button appearance="plain" @click=${this._close}>
            ${localize(lang, "common.cancel")}
          </ha-button>
          <ha-button
            appearance="plain"
            variant="brand"
            ?disabled=${this._saving}
            @click=${this._save}
          >
            ${this._saving ? localize(lang, "common.saving") : localize(lang, "common.save")}
          </ha-button>
        </div>
      </ha-dialog>
    `;
    }
};
AuroraAlarmDialog.styles = [
    auroraStyles,
    i$3 `
      ha-dialog {
        --dialog-content-padding: 4px 24px 16px;
      }
      .dlg-title {
        font-size: 1.2rem;
        font-weight: 600;
      }
      .footer-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        width: 100%;
      }
      /* HA selectors fill the dialog width and theme themselves. */
      ha-selector {
        display: block;
        width: 100%;
      }
      input.big-time {
        width: 100%;
        font-size: 3.2rem;
        text-align: center;
        border: none;
        background: transparent;
        padding: 4px 0 14px;
        color: var(--primary-text-color, var(--aurora-text));
      }
      .big-time:focus {
        outline: none;
      }
      .grid2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
        align-items: start;
      }
      .grid2 ha-selector {
        margin: 0;
      }
      .soundwrap {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .sliderrow {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 8px;
      }
      .sliderrow ha-selector {
        flex: 1;
      }
      .sliderrow ha-icon {
        --mdc-icon-size: 22px;
        color: var(--aurora-dim);
        flex: none;
      }
      .sliderrow .pct {
        font-variant-numeric: tabular-nums;
        font-weight: 600;
        width: 44px;
        text-align: right;
        color: var(--aurora-dim);
      }
      .seg {
        display: flex;
        background: color-mix(in srgb, var(--aurora-dim) 10%, transparent);
        border-radius: 999px;
        padding: 4px;
        gap: 4px;
      }
      .seg button {
        flex: 1;
        appearance: none;
        border: none;
        cursor: pointer;
        font: inherit;
        font-weight: 600;
        padding: 8px;
        border-radius: 999px;
        color: var(--aurora-dim);
        background: transparent;
      }
      .seg button.on {
        color: var(--aurora-on-accent);
        background: var(--aurora-accent-grad);
      }
      .block {
        margin-top: 18px;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 8px;
      }
      .chips button {
        appearance: none;
        border: 1px solid var(--aurora-divider);
        cursor: pointer;
        font: inherit;
        font-size: 0.85rem;
        font-weight: 600;
        padding: 7px 14px;
        border-radius: 999px;
        color: var(--aurora-dim);
        background: transparent;
      }
      .chips button.on {
        color: var(--aurora-on-accent);
        border-color: transparent;
        background: var(--aurora-accent-grad);
      }
      .togglerow {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 0;
        border-top: 1px solid var(--aurora-divider);
      }
      .togglerow .sub {
        font-size: 0.78rem;
        color: var(--aurora-dim);
        margin-top: 2px;
      }
      .hint {
        font-size: 0.82rem;
        color: var(--aurora-dim);
        margin-top: 6px;
        font-style: italic;
      }
    `,
];
__decorate([
    n({ attribute: false })
], AuroraAlarmDialog.prototype, "hass", void 0);
__decorate([
    n({ attribute: false })
], AuroraAlarmDialog.prototype, "alarm", void 0);
__decorate([
    n({ attribute: false })
], AuroraAlarmDialog.prototype, "profileId", void 0);
__decorate([
    n({ type: Boolean })
], AuroraAlarmDialog.prototype, "open", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_time", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_label", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_repeat", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_days", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_mission", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_missionParams", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_snoozeMax", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_snoozeMin", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_audioSource", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_audioCustom", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_presets", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_audioFade", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_volume", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_volEndMode", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_volEnd", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_light", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_lightMin", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_smart", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_smartMin", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_briefing", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_briefingBlocks", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_enabled", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_saving", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_display", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_displayTargets", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_displayOptions", void 0);
AuroraAlarmDialog = __decorate([
    t("aurora-alarm-dialog")
], AuroraAlarmDialog);

function summarize(alarm, language) {
    const s = alarm.schedule;
    if (s.repeat_mode === "daily")
        return localize(language, "summary.daily");
    if (s.repeat_mode === "once")
        return s.on_date
            ? localize(language, "summary.on_date", { date: s.on_date })
            : localize(language, "summary.once");
    if (!s.weekdays?.length)
        return localize(language, "summary.never");
    if (s.weekdays.length === 7)
        return localize(language, "summary.daily");
    return s.weekdays.map((d) => weekdayLetters(language)[d]).join(" ");
}
let AuroraAlarmList = class AuroraAlarmList extends i {
    constructor() {
        super(...arguments);
        /** When set, only show (and create) alarms for this profile. */
        this.profileId = null;
        this.showAll = false;
        this._alarms = [];
        this._loaded = false;
        this._editing = null;
        this._dialogOpen = false;
    }
    connectedCallback() {
        super.connectedCallback();
        this._subscribe();
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        this._unsub?.then((u) => u()).catch(() => undefined);
        this._unsub = undefined;
    }
    updated() {
        if (this.hass && !this._unsub)
            this._subscribe();
    }
    _subscribe() {
        if (!this.hass || this._unsub)
            return;
        this._unsub = subscribeAlarms(this.hass, (alarms) => {
            this._alarms = alarms;
            this._loaded = true;
        });
    }
    _add() {
        this._editing = null;
        this._dialogOpen = true;
    }
    _edit(alarm) {
        this._editing = alarm;
        this._dialogOpen = true;
    }
    get _visible() {
        if (this.showAll || !this.profileId)
            return this._alarms;
        return this._alarms.filter((a) => (a.profile_id ?? null) === this.profileId);
    }
    render() {
        const visible = this._visible;
        return b `
      <div class="card">
        <div class="head">
          <h3>${localize(this.hass?.language, "alarms.title")}</h3>
          <span class="spacer"></span>
          <button class="btn primary" @click=${this._add}>
            ${localize(this.hass?.language, "alarms.new")}
          </button>
        </div>

        ${!this._loaded
            ? b `<div class="empty"><div class="big">⏳</div>${localize(this.hass?.language, "common.loading")}</div>`
            : visible.length === 0
                ? b `<div class="empty">
                <div class="big">🌙</div>
                ${localize(this.hass?.language, "alarms.empty")}
              </div>`
                : b `<div class="list">
                ${visible.map((a) => this._row(a))}
              </div>`}
      </div>

      <aurora-alarm-dialog
        .hass=${this.hass}
        .alarm=${this._editing}
        .profileId=${this.profileId}
        .open=${this._dialogOpen}
        @closed=${() => (this._dialogOpen = false)}
      ></aurora-alarm-dialog>
    `;
    }
    _row(a) {
        return b `
      <div class="item ${a.enabled ? "" : "off"}" @click=${() => this._edit(a)}>
        <div class="time clock">${a.time}</div>
        <div class="meta">
          <div class="name">
            ${a.label || localize(this.hass?.language, "alarms.default_label")}${a.skip_next
            ? b `<span class="badge">${localize(this.hass?.language, "alarms.skip_badge")}</span>`
            : A}
          </div>
          <div class="when">${summarize(a, this.hass?.language)}</div>
        </div>
        <span class="spacer"></span>
        <button
          class="icon-btn"
          title=${localize(this.hass?.language, "alarms.skip_title")}
          @click=${(e) => {
            e.stopPropagation();
            updateAlarm(this.hass, a.id, { skip_next: !a.skip_next });
        }}
        >
          ${a.skip_next ? "⏭" : "⤼"}
        </button>
        <button
          class="icon-btn"
          title=${localize(this.hass?.language, "common.delete")}
          @click=${(e) => {
            e.stopPropagation();
            deleteAlarm(this.hass, a.id);
        }}
        >
          🗑
        </button>
        <div
          class="switch"
          role="switch"
          aria-checked=${a.enabled ? "true" : "false"}
          @click=${(e) => {
            e.stopPropagation();
            updateAlarm(this.hass, a.id, { enabled: !a.enabled });
        }}
        ></div>
      </div>
    `;
    }
};
AuroraAlarmList.styles = [
    auroraStyles,
    i$3 `
      .card {
        background: var(--aurora-surface);
        border: 1px solid var(--aurora-divider);
        border-radius: var(--aurora-radius);
        padding: 18px 20px;
      }
      .head {
        display: flex;
        align-items: center;
        margin-bottom: 10px;
      }
      .head h3 {
        margin: 0;
        font-size: 1.05rem;
        letter-spacing: 0.01em;
      }
      /* Responsive list: 1 column on mobile, multi-column on wider screens. */
      .list {
        display: grid;
        gap: 10px;
        grid-template-columns: 1fr;
      }
      @media (min-width: 720px) {
        .list {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      @media (min-width: 1100px) {
        .list {
          grid-template-columns: repeat(3, 1fr);
        }
      }
      .item {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px 16px;
        border-radius: var(--aurora-radius);
        background: var(--aurora-grad-soft);
        border: 1px solid var(--aurora-divider);
        cursor: pointer;
        transition: transform 0.12s ease, box-shadow 0.2s ease;
      }
      .item:hover {
        box-shadow: var(--aurora-shadow);
      }
      .item.off {
        opacity: 0.55;
      }
      .time {
        font-size: 1.9rem;
        min-width: 96px;
      }
      .meta {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .meta .name {
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .meta .when {
        font-size: 0.82rem;
        color: var(--aurora-dim);
        letter-spacing: 0.06em;
      }
      .badge {
        font-size: 0.68rem;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--aurora-accent);
        background: color-mix(in srgb, var(--aurora-accent) 14%, transparent);
        padding: 2px 7px;
        border-radius: 6px;
        margin-left: 6px;
      }
      .empty {
        text-align: center;
        padding: 34px 12px;
        color: var(--aurora-dim);
      }
      .empty .big {
        font-size: 2.4rem;
        margin-bottom: 8px;
      }
    `,
];
__decorate([
    n({ attribute: false })
], AuroraAlarmList.prototype, "hass", void 0);
__decorate([
    n({ attribute: false })
], AuroraAlarmList.prototype, "profileId", void 0);
__decorate([
    n({ type: Boolean })
], AuroraAlarmList.prototype, "showAll", void 0);
__decorate([
    r()
], AuroraAlarmList.prototype, "_alarms", void 0);
__decorate([
    r()
], AuroraAlarmList.prototype, "_loaded", void 0);
__decorate([
    r()
], AuroraAlarmList.prototype, "_editing", void 0);
__decorate([
    r()
], AuroraAlarmList.prototype, "_dialogOpen", void 0);
AuroraAlarmList = __decorate([
    t("aurora-alarm-list")
], AuroraAlarmList);

/** Generate an arithmetic problem. Difficulty: "easy" | "medium" | "hard". */
function makeMath(difficulty = "medium") {
    const r = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    if (difficulty === "easy") {
        const a = r(2, 9);
        const b = r(2, 9);
        return { question: `${a} + ${b}`, answer: a + b };
    }
    if (difficulty === "hard") {
        const a = r(6, 14);
        const b = r(6, 14);
        const c = r(2, 9);
        return { question: `${a} × ${b} + ${c}`, answer: a * b + c };
    }
    // medium
    const a = r(3, 12);
    const b = r(3, 12);
    return { question: `${a} × ${b}`, answer: a * b };
}
/** Magnitude of the change between two acceleration samples (for shake). */
function shakeMagnitude(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);
}
const SHAKE_THRESHOLD = 18; // per-sample magnitude that counts as a shake
const SHAKE_DEFAULT_COUNT = 12;
/**
 * Which mission to fall back to when `type` can't run on this device/setup
 * (no camera, no motion sensor, missing entity). Always terminates at "tap".
 */
function degradeMission(type) {
    switch (type) {
        case "vision":
            return "math";
        case "qr":
            return "math";
        case "shake":
            return "math";
        case "open_door":
            return "tap";
        case "math":
            return "tap";
        default:
            return "tap";
    }
}
/** Missions that need an active mission UI (everything except none/tap). */
function needsChallenge(type) {
    return type !== "none" && type !== "tap";
}

const VISION_MAX_FAILS = 3;
/**
 * Anti-snooze challenge shown over the ring. Emits `solved` once the active
 * mission is completed. Falls back to a simpler mission (and ultimately a tap)
 * when the device/setup can't run the requested one. Vision is wired in a later
 * increment — for now it degrades to math.
 */
let AuroraMissionOverlay = class AuroraMissionOverlay extends i {
    constructor() {
        super(...arguments);
        this.mission = { type: "tap" };
        this.alarmId = null;
        this._active = "tap";
        this._checking = false;
        this._visionFails = 0;
        this._math = null;
        this._input = "";
        this._wrong = false;
        this._shakes = 0;
        this._needMotionPerm = false;
        this._notice = "";
        this._solved = false;
        this._doorWasOpen = false;
    }
    connectedCallback() {
        super.connectedCallback();
        this._start(this.mission.type || "tap");
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        this._teardown();
    }
    get _lang() {
        return this.hass?.language;
    }
    _start(type) {
        this._teardown();
        this._active = type;
        this._wrong = false;
        this._notice = "";
        this._needMotionPerm = false;
        if (type === "math") {
            this._math = makeMath(String(this.mission.params?.["difficulty"] ?? "medium"));
            this._input = "";
        }
        else if (type === "shake") {
            this._startShake();
        }
        else if (type === "qr") {
            void this._startCamera(false);
        }
        else if (type === "vision") {
            this._checking = false;
            void this._startCamera(true);
        }
        else if (type === "open_door") {
            // Require a real, existing sensor; remember its state so we only solve on
            // an off → on transition (not if the door was already open at ring time).
            if (!this._doorEntity || !this.hass?.states[this._doorEntity]) {
                this._degrade();
            }
            else {
                this._doorWasOpen = this.hass.states[this._doorEntity].state === "on";
            }
        }
    }
    _degrade() {
        const next = degradeMission(this._active);
        this._notice = localize(this._lang, "missionui.degraded");
        this._start(next);
    }
    _solve() {
        if (this._solved)
            return;
        this._solved = true;
        this._teardown();
        this.dispatchEvent(new CustomEvent("solved", { bubbles: true, composed: true }));
    }
    _teardown() {
        if (this._scanTimer) {
            window.clearInterval(this._scanTimer);
            this._scanTimer = undefined;
        }
        if (this._motionHandler) {
            window.removeEventListener("devicemotion", this._motionHandler);
            this._motionHandler = undefined;
        }
        if (this._stream) {
            this._stream.getTracks().forEach((t) => t.stop());
            this._stream = undefined;
        }
    }
    // --- math ---------------------------------------------------------------
    _checkMath() {
        if (this._math && Number(this._input) === this._math.answer) {
            this._solve();
        }
        else {
            this._wrong = true;
            this._math = makeMath(String(this.mission.params?.["difficulty"] ?? "medium"));
            this._input = "";
        }
    }
    // --- shake --------------------------------------------------------------
    _startShake() {
        this._shakes = 0;
        const DM = window.DeviceMotionEvent;
        if (!DM) {
            this._degrade();
            return;
        }
        if (typeof DM.requestPermission === "function") {
            this._needMotionPerm = true; // iOS: user gesture required
            return;
        }
        this._listenMotion();
    }
    async _enableMotion() {
        if (this._active !== "shake")
            return; // ignore a stale click after degrade
        const DM = window.DeviceMotionEvent;
        try {
            const res = await DM.requestPermission?.();
            if (res === "granted") {
                this._needMotionPerm = false;
                this._listenMotion();
            }
            else {
                this._degrade();
            }
        }
        catch {
            this._degrade();
        }
    }
    _listenMotion() {
        const target = Number(this.mission.params?.["count"] ?? SHAKE_DEFAULT_COUNT) || SHAKE_DEFAULT_COUNT;
        this._motionHandler = (e) => {
            const a = e.accelerationIncludingGravity;
            if (!a || a.x == null || a.y == null || a.z == null)
                return;
            const cur = { x: a.x, y: a.y, z: a.z };
            if (this._last && shakeMagnitude(cur, this._last) > SHAKE_THRESHOLD) {
                this._shakes += 1;
                if (this._shakes >= target)
                    this._solve();
            }
            this._last = cur;
        };
        window.addEventListener("devicemotion", this._motionHandler);
    }
    // --- camera (qr + vision selfie) ----------------------------------------
    async _startCamera(selfie) {
        const kind = selfie ? "vision" : "qr";
        const BD = window
            .BarcodeDetector;
        // QR needs the BarcodeDetector; the selfie only needs a camera.
        if (!navigator.mediaDevices?.getUserMedia || (!selfie && !BD)) {
            this._notice = localize(this._lang, "missionui.nocam");
            this._degrade();
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: selfie ? "user" : "environment" },
            });
            // The component may have been torn down (solved/degraded/disconnected)
            // while getUserMedia was pending — don't leak the camera track.
            if (!this.isConnected || this._active !== kind) {
                stream.getTracks().forEach((t) => t.stop());
                return;
            }
            this._stream = stream;
            await this.updateComplete;
            if (!this.isConnected || this._active !== kind) {
                this._teardown();
                return;
            }
            const video = this.renderRoot.querySelector("video");
            if (!video) {
                this._degrade();
                return;
            }
            video.srcObject = this._stream;
            await video.play();
            if (selfie || !BD)
                return; // selfie waits for the capture button
            const detector = new BD({ formats: ["qr_code"] });
            const expected = String(this.mission.params?.["value"] ?? "");
            this._scanTimer = window.setInterval(async () => {
                try {
                    const codes = await detector.detect(video);
                    for (const c of codes) {
                        if (!expected || c.rawValue === expected) {
                            this._solve();
                            return;
                        }
                    }
                }
                catch {
                    /* transient detect errors are ignored */
                }
            }, 400);
        }
        catch {
            this._notice = localize(this._lang, "missionui.nocam");
            this._degrade();
        }
    }
    // --- vision (selfie) ----------------------------------------------------
    async _captureSelfie() {
        if (this._checking)
            return;
        const video = this.renderRoot.querySelector("video");
        if (!video || !video.videoWidth)
            return;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            this._degrade();
            return;
        }
        ctx.drawImage(video, 0, 0);
        const image = canvas.toDataURL("image/jpeg", 0.6);
        this._checking = true;
        this._notice = "";
        try {
            const res = await visionCheck(this.hass, image, this.alarmId);
            if (res.awake) {
                this._solve();
                return;
            }
            this._visionFails += 1;
            this._notice = localize(this._lang, "missionui.vision_failed");
            if (this._visionFails >= VISION_MAX_FAILS)
                this._degrade();
        }
        catch {
            this._visionFails += 1;
            this._notice = localize(this._lang, "missionui.vision_failed");
            if (this._visionFails >= VISION_MAX_FAILS)
                this._degrade();
        }
        finally {
            this._checking = false;
        }
    }
    // --- open_door ----------------------------------------------------------
    get _doorEntity() {
        return String(this.mission.params?.["entity_id"] ?? "");
    }
    updated() {
        if (this._active === "open_door" && this._doorEntity && !this._solved) {
            const open = this.hass?.states[this._doorEntity]?.state === "on";
            if (open && !this._doorWasOpen)
                this._solve();
            this._doorWasOpen = open;
        }
    }
    render() {
        return b `<div class="wrap">${this._body()} ${this._noticeEl()}</div>`;
    }
    _noticeEl() {
        return this._notice
            ? b `<div class="notice">${this._notice}</div>`
            : A;
    }
    _body() {
        switch (this._active) {
            case "math":
                return b `
          <div class="prompt">${localize(this._lang, "missionui.math_prompt")}</div>
          <div class="math clock">${this._math?.question ?? ""} =</div>
          <input
            class="ans"
            type="number"
            inputmode="numeric"
            .value=${this._input}
            @input=${(e) => (this._input = e.target.value)}
            @keydown=${(e) => e.key === "Enter" && this._checkMath()}
          />
          ${this._wrong
                    ? b `<div class="wrong">${localize(this._lang, "missionui.wrong")}</div>`
                    : A}
          <button class="big-btn" @click=${this._checkMath}>
            ${localize(this._lang, "missionui.check")}
          </button>
        `;
            case "shake":
                return b `
          <div class="prompt">${localize(this._lang, "missionui.shake_prompt")}</div>
          ${this._needMotionPerm
                    ? b `<button class="big-btn" @click=${this._enableMotion}>
                ${localize(this._lang, "missionui.shake_enable")}
              </button>`
                    : b `<div class="shakebar">
                <i style=${`width:${Math.min(100, (this._shakes / (Number(this.mission.params?.["count"] ?? SHAKE_DEFAULT_COUNT) || SHAKE_DEFAULT_COUNT)) * 100)}%`}></i>
              </div>`}
        `;
            case "qr":
                return b `
          <div class="prompt">${localize(this._lang, "missionui.qr_prompt")}</div>
          <video playsinline muted></video>
        `;
            case "vision":
                return b `
          <div class="prompt">${localize(this._lang, "missionui.vision_prompt")}</div>
          <video playsinline muted></video>
          <button class="big-btn" ?disabled=${this._checking} @click=${this._captureSelfie}>
            ${this._checking
                    ? localize(this._lang, "missionui.checking")
                    : localize(this._lang, "missionui.capture")}
          </button>
        `;
            case "open_door": {
                const name = this.hass?.states[this._doorEntity]?.attributes.friendly_name ||
                    localize(this._lang, "missionui.door");
                return b `<div class="prompt">
          ${localize(this._lang, "missionui.opendoor_prompt", { name: String(name) })}
        </div>`;
            }
            default:
                // tap (terminal fallback): a single confirm.
                return b `<button class="big-btn" @click=${this._solve}>
          ${localize(this._lang, "ring.stop")}
        </button>`;
        }
    }
};
AuroraMissionOverlay.styles = [
    auroraStyles,
    i$3 `
      .wrap {
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 18px;
        max-width: 360px;
      }
      .prompt {
        font-size: 1.3rem;
        font-weight: 600;
      }
      .math {
        font-size: 2.6rem;
        font-weight: 800;
        letter-spacing: 0.02em;
      }
      input.ans {
        font-size: 1.6rem;
        text-align: center;
        width: 160px;
      }
      .notice,
      .wrong {
        font-size: 0.95rem;
        opacity: 0.85;
      }
      .wrong {
        color: #ffd2d2;
      }
      video {
        width: min(80vw, 320px);
        border-radius: 18px;
        background: #000;
      }
      .shakebar {
        width: 220px;
        height: 12px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.25);
        overflow: hidden;
      }
      .shakebar > i {
        display: block;
        height: 100%;
        background: var(--aurora-accent-grad);
        transition: width 0.15s ease;
      }
      .big-btn {
        appearance: none;
        border: none;
        cursor: pointer;
        font: inherit;
        font-weight: 700;
        font-size: 1.05rem;
        padding: 14px 28px;
        border-radius: 999px;
        color: var(--aurora-on-accent);
        background: var(--aurora-accent-grad);
      }
      .row {
        display: flex;
        gap: 12px;
        align-items: center;
      }
    `,
];
__decorate([
    n({ attribute: false })
], AuroraMissionOverlay.prototype, "hass", void 0);
__decorate([
    n({ attribute: false })
], AuroraMissionOverlay.prototype, "mission", void 0);
__decorate([
    n({ attribute: false })
], AuroraMissionOverlay.prototype, "alarmId", void 0);
__decorate([
    r()
], AuroraMissionOverlay.prototype, "_active", void 0);
__decorate([
    r()
], AuroraMissionOverlay.prototype, "_checking", void 0);
__decorate([
    r()
], AuroraMissionOverlay.prototype, "_visionFails", void 0);
__decorate([
    r()
], AuroraMissionOverlay.prototype, "_math", void 0);
__decorate([
    r()
], AuroraMissionOverlay.prototype, "_input", void 0);
__decorate([
    r()
], AuroraMissionOverlay.prototype, "_wrong", void 0);
__decorate([
    r()
], AuroraMissionOverlay.prototype, "_shakes", void 0);
__decorate([
    r()
], AuroraMissionOverlay.prototype, "_needMotionPerm", void 0);
__decorate([
    r()
], AuroraMissionOverlay.prototype, "_notice", void 0);
AuroraMissionOverlay = __decorate([
    t("aurora-mission-overlay")
], AuroraMissionOverlay);

let AuroraRingOverlay = class AuroraRingOverlay extends i {
    constructor() {
        super(...arguments);
        this._now = new Date();
        this._showMission = false;
    }
    connectedCallback() {
        super.connectedCallback();
        this._timer = window.setInterval(() => (this._now = new Date()), 1000);
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._timer)
            window.clearInterval(this._timer);
    }
    get _sensor() {
        return Object.values(this.hass?.states ?? {}).find((e) => e.entity_id.startsWith("binary_sensor.aurora"));
    }
    get _ringing() {
        return this._sensor?.state === "on";
    }
    get _mission() {
        const m = this._sensor?.attributes?.mission;
        return m ?? { type: "tap" };
    }
    get _alarmId() {
        return this._sensor?.attributes?.alarm_id ?? null;
    }
    _dismiss() {
        this._showMission = false;
        ringAction(this.hass, "dismiss");
    }
    _onStop() {
        // A real mission must be solved first; tap/none dismiss immediately.
        if (needsChallenge(this._mission.type)) {
            this._showMission = true;
        }
        else {
            this._dismiss();
        }
    }
    updated() {
        // Close the mission overlay once the ring is gone (don't mutate in render()).
        if (!this._ringing && this._showMission)
            this._showMission = false;
    }
    render() {
        if (!this._ringing)
            return A;
        const hh = String(this._now.getHours()).padStart(2, "0");
        const mm = String(this._now.getMinutes()).padStart(2, "0");
        const challenge = needsChallenge(this._mission.type);
        return b `
      <div class="overlay">
        <div class="sky"></div>
        <div class="sun"></div>
        <div class="content">
          ${this._showMission
            ? b `<aurora-mission-overlay
                .hass=${this.hass}
                .mission=${this._mission}
                .alarmId=${this._alarmId}
                @solved=${this._dismiss}
              ></aurora-mission-overlay>`
            : b `
                <div class="big clock">${hh}:${mm}</div>
                <div class="label">${localize(this.hass?.language, "ring.label")}</div>
                <div class="actions">
                  <button class="big-btn snooze" @click=${() => ringAction(this.hass, "snooze")}>
                    ${localize(this.hass?.language, "ring.snooze")}
                  </button>
                  <button class="big-btn stop" @click=${this._onStop}>
                    ${challenge
                ? localize(this.hass?.language, "ring.start_mission")
                : localize(this.hass?.language, "ring.stop")}
                  </button>
                </div>
              `}
          ${this._showMission
            ? b `<div class="actions">
                <button class="big-btn snooze" @click=${() => (this._showMission = false)}>
                  ${localize(this.hass?.language, "missionui.back")}
                </button>
              </div>`
            : A}
        </div>
      </div>
    `;
    }
};
AuroraRingOverlay.styles = [
    auroraStyles,
    i$3 `
      .overlay {
        position: relative;
        min-height: 360px;
        border-radius: var(--aurora-radius);
        display: grid;
        place-items: center;
        color: #fff;
        overflow: hidden;
        background: #14122a;
      }
      .sky {
        position: absolute;
        inset: 0;
        background:
          radial-gradient(120% 80% at 50% 118%, #ffd27a 0%, #f0883e 22%, #a44a86 48%, #3a2a6b 72%, #14122a 100%);
        animation: rise 7s ease-out both;
      }
      .sun {
        position: absolute;
        left: 50%;
        bottom: -34vh;
        width: 64vh;
        height: 64vh;
        transform: translateX(-50%);
        border-radius: 50%;
        background: radial-gradient(circle, #fff3d0 0%, #ffd27a 38%, rgba(255, 210, 122, 0) 70%);
        animation: sunrise 7s ease-out both;
        filter: blur(2px);
      }
      .content {
        position: relative;
        text-align: center;
        padding: 24px;
        animation: fadein 0.6s ease both;
      }
      .big {
        font-size: clamp(4rem, 18vw, 11rem);
        text-shadow: 0 6px 40px rgba(0, 0, 0, 0.35);
      }
      .label {
        font-size: 1.3rem;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        opacity: 0.92;
        margin-top: 4px;
      }
      .actions {
        margin-top: 40px;
        display: flex;
        gap: 18px;
        justify-content: center;
      }
      .big-btn {
        appearance: none;
        border: none;
        cursor: pointer;
        font: inherit;
        font-weight: 700;
        font-size: 1.1rem;
        padding: 18px 34px;
        border-radius: 999px;
        backdrop-filter: blur(6px);
        transition: transform 0.12s ease;
      }
      .big-btn:active {
        transform: scale(0.95);
      }
      .stop {
        color: #2a1840;
        background: #fff;
      }
      .snooze {
        color: #fff;
        background: rgba(255, 255, 255, 0.18);
        border: 1px solid rgba(255, 255, 255, 0.4);
      }
      @keyframes rise {
        from {
          filter: brightness(0.35) saturate(0.8);
        }
        to {
          filter: brightness(1) saturate(1);
        }
      }
      @keyframes sunrise {
        from {
          transform: translateX(-50%) translateY(34vh);
          opacity: 0.2;
        }
        to {
          transform: translateX(-50%) translateY(0);
          opacity: 1;
        }
      }
      @keyframes fadein {
        from {
          opacity: 0;
          transform: translateY(12px);
        }
      }
    `,
];
__decorate([
    n({ attribute: false })
], AuroraRingOverlay.prototype, "hass", void 0);
__decorate([
    r()
], AuroraRingOverlay.prototype, "_now", void 0);
__decorate([
    r()
], AuroraRingOverlay.prototype, "_showMission", void 0);
AuroraRingOverlay = __decorate([
    t("aurora-ring-overlay")
], AuroraRingOverlay);

/**
 * Visual editor for the Aurora dashboard card. Exposes the card title and the
 * "ring animation" opt-in: whether this card shows the in-card ringing
 * animation when an alarm rings (off by default).
 */
let AuroraCardEditor = class AuroraCardEditor extends i {
    constructor() {
        super(...arguments);
        this._config = { type: "custom:aurora-card" };
    }
    setConfig(config) {
        this._config = config;
    }
    _emit(patch) {
        const next = { ...this._config, ...patch };
        this._config = next;
        this.dispatchEvent(new CustomEvent("config-changed", {
            detail: { config: next },
            bubbles: true,
            composed: true,
        }));
    }
    render() {
        if (!this.hass)
            return A;
        const lang = this.hass.language;
        return b `
      <div class="form">
        <ha-selector
          .hass=${this.hass}
          .selector=${{ text: {} }}
          .label=${localize(lang, "carded.title")}
          .value=${this._config.title ?? ""}
          @value-changed=${(e) => this._emit({ title: e.detail.value ?? "" })}
        ></ha-selector>

        <div class="togglerow">
          <ha-switch
            .checked=${this._config.ring_animation ?? this._config.ring_screen ?? false}
            @change=${(e) => this._emit({ ring_animation: e.target.checked })}
          ></ha-switch>
          <div class="t">
            ${localize(lang, "carded.ring_animation")}
            <div class="sub">${localize(lang, "carded.ring_animation_desc")}</div>
          </div>
        </div>
      </div>
    `;
    }
};
AuroraCardEditor.styles = [
    auroraStyles,
    i$3 `
      .form {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 4px 2px;
      }
      .togglerow {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .togglerow .t {
        flex: 1;
      }
      .togglerow .sub {
        font-size: 0.8rem;
        color: var(--aurora-dim);
        margin-top: 2px;
        line-height: 1.4;
      }
    `,
];
__decorate([
    n({ attribute: false })
], AuroraCardEditor.prototype, "hass", void 0);
__decorate([
    r()
], AuroraCardEditor.prototype, "_config", void 0);
AuroraCardEditor = __decorate([
    t("aurora-card-editor")
], AuroraCardEditor);

let AuroraCard = class AuroraCard extends i {
    constructor() {
        super(...arguments);
        this._config = { type: "" };
    }
    setConfig(config) {
        this._config = config;
    }
    getCardSize() {
        return 6;
    }
    static getStubConfig() {
        return { title: "Aurora", ring_animation: false };
    }
    get _ringAnimation() {
        return this._config.ring_animation ?? this._config.ring_screen ?? false;
    }
    static getConfigElement() {
        return document.createElement("aurora-card-editor");
    }
    /**
     * The next-alarm sensor's entity_id is locale-dependent (has_entity_name +
     * translation_key → e.g. sensor.aurora_prossima_sveglia in Italian), so we
     * never hardcode the English slug. Match the timestamp sensor under Aurora.
     */
    _nextAlarmState() {
        const states = this.hass?.states ?? {};
        return Object.values(states).find((s) => s.entity_id.startsWith("sensor.aurora") &&
            s.attributes?.device_class === "timestamp");
    }
    _hero() {
        const next = this._nextAlarmState();
        const valid = next && next.state && !["unknown", "unavailable"].includes(next.state);
        let time = "—";
        let sub = localize(this.hass?.language, "card.no_alarm");
        if (valid) {
            const dt = new Date(next.state);
            time = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            sub = this._relative(dt);
            const label = next.attributes?.["label"];
            if (label)
                sub = `${label} · ${sub}`;
        }
        return b `
      <div class="hero">
        <div class="hero-k">${localize(this.hass?.language, "card.next_alarm")}</div>
        <div class="hero-time clock">${time}</div>
        <div class="hero-sub">${sub}</div>
      </div>
    `;
    }
    _relative(dt) {
        const lang = this.hass?.language;
        const diff = dt.getTime() - Date.now();
        if (diff <= 0)
            return localize(lang, "rel.now");
        const mins = Math.round(diff / 60000);
        if (mins < 60)
            return localize(lang, "rel.in_min", { n: mins });
        const hrs = Math.floor(mins / 60);
        const rem = mins % 60;
        if (hrs < 24)
            return rem
                ? localize(lang, "rel.in_hm", { h: hrs, m: rem })
                : localize(lang, "rel.in_h", { h: hrs });
        const days = Math.round(hrs / 24);
        return days === 1
            ? localize(lang, "rel.in_day")
            : localize(lang, "rel.in_days", { n: days });
    }
    render() {
        if (!this.hass)
            return A;
        return b `
      <ha-card>
        <div class="wrap">
          ${this._config.title
            ? b `<div class="card-title">${this._config.title}</div>`
            : A}
          ${this._hero()}
          <div class="body">
            <aurora-alarm-list
              .hass=${this.hass}
              .profileId=${this.hass.user?.id ?? null}
            ></aurora-alarm-list>
            <a class="open" href="/aurora">${localize(this.hass?.language, "card.open_app")}</a>
          </div>
        </div>
        ${this._ringAnimation
            ? b `<aurora-ring-overlay .hass=${this.hass}></aurora-ring-overlay>`
            : A}
      </ha-card>
    `;
    }
};
AuroraCard.styles = [
    auroraStyles,
    i$3 `
      ha-card {
        overflow: hidden;
      }
      .wrap {
        padding: 0 0 16px;
      }
      .hero {
        position: relative;
        padding: 26px 22px 30px;
        color: var(--aurora-on-accent);
        background: var(--aurora-accent-grad);
        overflow: hidden;
      }
      .hero::after {
        content: "";
        position: absolute;
        right: -40px;
        top: -60px;
        width: 200px;
        height: 200px;
        border-radius: 50%;
        background: radial-gradient(
          circle,
          color-mix(in srgb, var(--aurora-on-accent) 16%, transparent),
          transparent 70%
        );
      }
      .hero-k {
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-size: 0.72rem;
        opacity: 0.85;
      }
      .hero-time {
        font-size: 4rem;
        margin: 2px 0 2px;
      }
      .hero-sub {
        opacity: 0.92;
        font-weight: 500;
      }
      .card-title {
        padding: 14px 18px 0;
        font-weight: 700;
        font-size: 1.05rem;
      }
      .body {
        padding: 18px 16px 0;
      }
      .open {
        display: block;
        text-align: center;
        margin-top: 16px;
        text-decoration: none;
        color: var(--aurora-accent);
        font-weight: 600;
      }
    `,
];
__decorate([
    n({ attribute: false })
], AuroraCard.prototype, "hass", void 0);
__decorate([
    r()
], AuroraCard.prototype, "_config", void 0);
AuroraCard = __decorate([
    t("aurora-card")
], AuroraCard);

/**
 * Info-only wake overlay rendered fullscreen on a pushed display (/aurora/ring).
 * It shows the time, the alarm label and a sunrise gradient — NO buttons, no
 * mission, no interaction. It is a software sunrise lamp, not an alarm control.
 */
let AuroraRingDisplay = class AuroraRingDisplay extends i {
    constructor() {
        super(...arguments);
        this._now = new Date();
    }
    connectedCallback() {
        super.connectedCallback();
        this._timer = window.setInterval(() => (this._now = new Date()), 1000);
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._timer)
            window.clearInterval(this._timer);
    }
    get _sensor() {
        return Object.values(this.hass?.states ?? {}).find((e) => e.entity_id.startsWith("binary_sensor.aurora"));
    }
    get _ringing() {
        return this._sensor?.state === "on";
    }
    get _label() {
        return this._sensor?.attributes?.["label"] ?? "";
    }
    /**
     * Interpolate the near-horizon gradient stop from the alarm's light colour
     * temperature. Warmth factor t=0 (2200 K, very warm) → #ffd27a;
     * t=1 (6500 K, cool daylight) → #cfe0ff. Falls back to the warm default
     * when no kelvin value is available.
     */
    get _horizonColor() {
        const k = this._sensor?.attributes?.["color_temp_kelvin"];
        if (k == null)
            return "#ffd27a";
        const t = Math.max(0, Math.min(1, (k - 2200) / (6500 - 2200)));
        // Interpolate #ffd27a → #cfe0ff channel by channel
        const r = Math.round(0xff + (0xcf - 0xff) * t);
        const g = Math.round(0xd2 + (0xe0 - 0xd2) * t);
        const b = Math.round(0x7a + (0xff - 0x7a) * t);
        return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    }
    render() {
        if (!this.hass)
            return A;
        const hh = String(this._now.getHours()).padStart(2, "0");
        const mm = String(this._now.getMinutes()).padStart(2, "0");
        if (!this._ringing) {
            return b `<div class="screen"><div class="content">
        <div class="big clock">${hh}:${mm}</div>
      </div></div>`;
        }
        return b `<div class="screen">
      <div class="sky" style="--aurora-horizon:${this._horizonColor}"></div>
      <div class="content">
        <div class="big clock">${hh}:${mm}</div>
        <div class="label">${this._label || localize(this.hass?.language, "ring.label")}</div>
      </div>
    </div>`;
    }
};
AuroraRingDisplay.styles = [
    auroraStyles,
    i$3 `
      .screen {
        position: fixed;
        inset: 0;
        display: grid;
        place-items: center;
        color: #fff;
        overflow: hidden;
        background: #14122a;
      }
      .sky {
        position: absolute;
        inset: 0;
        background: radial-gradient(120% 80% at 50% 118%,
          var(--aurora-horizon, #ffd27a) 0%, #f0883e 22%, #a44a86 48%, #3a2a6b 72%, #14122a 100%);
        animation: rise 7s ease-out both;
      }
      .content { position: relative; text-align: center; }
      .big { font-size: clamp(5rem, 22vw, 14rem); text-shadow: 0 6px 40px rgba(0,0,0,.35); }
      .label { font-size: 1.4rem; letter-spacing: .16em; text-transform: uppercase; opacity: .9; }
      .idle { opacity: .5; font-size: 1.1rem; }
      @keyframes rise { from { filter: brightness(.3) saturate(.8); } to { filter: brightness(1); } }
    `,
];
__decorate([
    n({ attribute: false })
], AuroraRingDisplay.prototype, "hass", void 0);
__decorate([
    r()
], AuroraRingDisplay.prototype, "_now", void 0);
AuroraRingDisplay = __decorate([
    t("aurora-ring-display")
], AuroraRingDisplay);

const DAYS = 7;
/** Local YYYY-MM-DD (not UTC — `on_date` is a local calendar date). */
function ymd(d) {
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
}
/** Weekday index with Monday = 0 (Aurora's convention), from a JS Date. */
function mondayIdx(d) {
    return (d.getDay() + 6) % 7;
}
function firesOn(alarm, date) {
    if (!alarm.enabled)
        return false;
    const s = alarm.schedule;
    if (s.repeat_mode === "daily")
        return true;
    if (s.repeat_mode === "once")
        return !!s.on_date && s.on_date === ymd(date);
    return (s.weekdays ?? []).includes(mondayIdx(date));
}
let AuroraScheduleCard = class AuroraScheduleCard extends i {
    constructor() {
        super(...arguments);
        /** When set (and not showAll), only show alarms for this profile. */
        this.profileId = null;
        this.showAll = false;
        this._alarms = [];
    }
    connectedCallback() {
        super.connectedCallback();
        this._subscribe();
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        this._unsub?.then((u) => u()).catch(() => undefined);
        this._unsub = undefined;
    }
    updated() {
        if (this.hass && !this._unsub)
            this._subscribe();
    }
    _subscribe() {
        if (!this.hass || this._unsub)
            return;
        this._unsub = subscribeAlarms(this.hass, (alarms) => {
            this._alarms = alarms;
        });
    }
    get _visible() {
        if (this.showAll || !this.profileId)
            return this._alarms;
        return this._alarms.filter((a) => (a.profile_id ?? null) === this.profileId);
    }
    /** First day (within a fortnight) an alarm fires — used to flag skip_next. */
    _firstOccurrence(alarm) {
        const d = new Date();
        for (let i = 0; i < 14; i++) {
            if (firesOn(alarm, d))
                return ymd(d);
            d.setDate(d.getDate() + 1);
        }
        return null;
    }
    get _week() {
        const alarms = this._visible;
        const firstByAlarm = new Map(alarms.map((a) => [a.id, a.skip_next ? this._firstOccurrence(a) : null]));
        const cells = [];
        const base = new Date();
        for (let i = 0; i < DAYS; i++) {
            const date = new Date(base);
            date.setDate(base.getDate() + i);
            const key = ymd(date);
            const entries = alarms
                .filter((a) => firesOn(a, date))
                .sort((x, y) => x.time.localeCompare(y.time))
                .map((a) => ({ alarm: a, skipped: firstByAlarm.get(a.id) === key }));
            cells.push({ date, today: i === 0, entries });
        }
        return cells;
    }
    render() {
        const lang = this.hass?.language;
        const short = localize(lang, "weekday.short").split(",");
        return b `
      <div class="card">
        <div class="head"><h3>${localize(lang, "schedule.title")}</h3></div>
        <div class="week">
          ${this._week.map((cell) => b `
              <div class="day ${cell.today ? "today" : ""}">
                <div class="dh">
                  <span class="dow">${short[mondayIdx(cell.date)]}</span>
                  <span class="dnum">${cell.date.getDate()}</span>
                </div>
                <div class="chips">
                  ${cell.entries.length === 0
            ? b `<span class="none">—</span>`
            : cell.entries.map((e) => b `<span
                          class="chip ${e.skipped ? "skip" : ""}"
                          title=${e.alarm.label || ""}
                        >
                          <span class="clock">${e.alarm.time}</span>
                          ${e.alarm.label ? b `<small>${e.alarm.label}</small>` : A}
                        </span>`)}
                </div>
              </div>
            `)}
        </div>
      </div>
    `;
    }
};
AuroraScheduleCard.styles = [
    auroraStyles,
    i$3 `
      .card {
        background: var(--aurora-surface);
        border: 1px solid var(--aurora-divider);
        border-radius: var(--aurora-radius);
        padding: 18px 20px;
      }
      .head {
        display: flex;
        align-items: center;
        margin-bottom: 14px;
      }
      .head h3 {
        margin: 0;
        font-size: 1.05rem;
        letter-spacing: 0.01em;
      }
      .week {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(7, 1fr);
      }
      .day {
        background: var(--aurora-grad-soft);
        border: 1px solid var(--aurora-divider);
        border-radius: var(--aurora-radius-sm);
        padding: 10px 10px 12px;
        min-height: 92px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .day.today {
        border-color: color-mix(in srgb, var(--aurora-accent) 55%, transparent);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--aurora-accent) 35%, transparent);
      }
      .dh {
        display: flex;
        align-items: baseline;
        gap: 6px;
      }
      .dow {
        font-weight: 700;
        font-size: 0.74rem;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--aurora-dim);
      }
      .day.today .dow {
        color: var(--aurora-accent);
      }
      .dnum {
        font-weight: 700;
        font-size: 1rem;
      }
      .chips {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .chip {
        align-self: flex-start;
        background: color-mix(in srgb, var(--aurora-accent) 16%, transparent);
        color: var(--aurora-accent);
        font-weight: 700;
        font-size: 0.82rem;
        padding: 3px 9px;
        border-radius: 8px;
        white-space: nowrap;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .chip small {
        color: var(--aurora-dim);
        font-weight: 600;
        margin-left: 5px;
      }
      .chip.skip {
        text-decoration: line-through;
        color: var(--aurora-dim);
        background: color-mix(in srgb, var(--aurora-dim) 14%, transparent);
      }
      .none {
        color: var(--aurora-dim);
        opacity: 0.5;
        font-size: 1.1rem;
      }
      /* Mobile: the 7 columns become rows (weekday → row of time chips). */
      @media (max-width: 640px) {
        .week {
          grid-template-columns: 1fr;
          gap: 8px;
        }
        .day {
          flex-direction: row;
          align-items: center;
          min-height: 0;
          padding: 10px 12px;
        }
        .dh {
          flex: 0 0 76px;
          flex-direction: column;
          gap: 0;
          align-items: flex-start;
        }
        .chips {
          flex-direction: row;
          flex-wrap: wrap;
        }
      }
    `,
];
__decorate([
    n({ attribute: false })
], AuroraScheduleCard.prototype, "hass", void 0);
__decorate([
    n({ attribute: false })
], AuroraScheduleCard.prototype, "profileId", void 0);
__decorate([
    n({ type: Boolean })
], AuroraScheduleCard.prototype, "showAll", void 0);
__decorate([
    r()
], AuroraScheduleCard.prototype, "_alarms", void 0);
AuroraScheduleCard = __decorate([
    t("aurora-schedule-card")
], AuroraScheduleCard);

/**
 * Friendly entity picker used for role bindings.
 * - single: a dropdown of friendly names (+ a "none" option).
 * - multiple: chosen entities as removable pills + a searchable "add…"
 *   dropdown of the remaining candidates (so long lists never overwhelm).
 * Emits a `change` event with the new value (string or string[]).
 */
let AuroraEntityPicker = class AuroraEntityPicker extends i {
    constructor() {
        super(...arguments);
        this.options = [];
        this.value = "";
        this.multiple = false;
    }
    _name(id) {
        return this.hass?.states[id]?.attributes.friendly_name || id;
    }
    _sorted(ids) {
        return [...ids].sort((a, b) => this._name(a).localeCompare(this._name(b)));
    }
    _emit(value) {
        this.dispatchEvent(new CustomEvent("change", { detail: value }));
    }
    render() {
        if (!this.options.length) {
            return b `<div class="none">${localize(this.hass?.language, "picker.none")}</div>`;
        }
        return this.multiple ? this._renderMulti() : this._renderSingle();
    }
    _renderSingle() {
        const value = this.value || "";
        return b `
      <select
        .value=${value}
        @change=${(e) => this._emit(e.target.value)}
      >
        <option value="" ?selected=${value === ""}>${localize(this.hass?.language, "picker.empty_option")}</option>
        ${this._sorted(this.options).map((id) => b `<option value=${id} ?selected=${id === value} title=${id}>
            ${this._name(id)}
          </option>`)}
      </select>
    `;
    }
    _renderMulti() {
        const value = Array.isArray(this.value) ? this.value : [];
        const remaining = this._sorted(this.options.filter((id) => !value.includes(id)));
        return b `
      ${value.length
            ? b `<div class="pills">
            ${value.map((id) => b `<div class="pill" title=${id}>
                <span>${this._name(id)}</span>
                <button @click=${() => this._emit(value.filter((x) => x !== id))}>✕</button>
              </div>`)}
          </div>`
            : A}
      ${remaining.length
            ? b `<div class="add">
            <select
              @change=${(e) => {
                const sel = e.target;
                if (sel.value) {
                    this._emit([...value, sel.value]);
                    sel.value = "";
                }
            }}
            >
              <option value="">${localize(this.hass?.language, "picker.add")}</option>
              ${remaining.map((id) => b `<option value=${id} title=${id}>${this._name(id)}</option>`)}
            </select>
          </div>`
            : A}
    `;
    }
};
AuroraEntityPicker.styles = [
    auroraStyles,
    i$3 `
      select {
        width: 100%;
      }
      .none {
        font-size: 0.85rem;
        color: var(--aurora-dim);
        font-style: italic;
      }
      .pills {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 10px;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 7px 8px 7px 13px;
        border-radius: 999px;
        color: var(--aurora-on-accent);
        background: var(--aurora-accent-grad);
        font-size: 0.85rem;
        font-weight: 600;
        max-width: 100%;
      }
      .pill span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .pill button {
        appearance: none;
        border: none;
        cursor: pointer;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: color-mix(in srgb, var(--aurora-on-accent) 22%, transparent);
        color: var(--aurora-on-accent);
        font-size: 13px;
        line-height: 1;
        flex: none;
      }
      .add {
        position: relative;
      }
      .add select {
        color: var(--aurora-accent);
        font-weight: 600;
      }
    `,
];
__decorate([
    n({ attribute: false })
], AuroraEntityPicker.prototype, "hass", void 0);
__decorate([
    n({ attribute: false })
], AuroraEntityPicker.prototype, "options", void 0);
__decorate([
    n({ attribute: false })
], AuroraEntityPicker.prototype, "value", void 0);
__decorate([
    n({ type: Boolean })
], AuroraEntityPicker.prototype, "multiple", void 0);
AuroraEntityPicker = __decorate([
    t("aurora-entity-picker")
], AuroraEntityPicker);

/**
 * A themed media picker overlay over Home Assistant's media-browse tree.
 *
 * Navigates folders, adds playable entries, and accepts a pasted URI. With
 * `multiple` it builds a selection tray (for playlists); otherwise the first
 * pick closes immediately. Emits `select` with `{ items: PresetItem[] }`, or
 * `closed` when dismissed. It is a self-contained overlay (no nested dialog).
 */
let AuroraMediaBrowser = class AuroraMediaBrowser extends i {
    constructor() {
        super(...arguments);
        /** Bind a player for its full source tree; null browses media sources only. */
        this.entityId = null;
        this.open = false;
        this.multiple = false;
        this._stack = [];
        this._loading = false;
        this._error = "";
        this._selected = [];
        this._uri = "";
        this._opened = false;
    }
    willUpdate(changed) {
        if (changed.has("open")) {
            if (this.open && !this._opened) {
                this._opened = true;
                this._stack = [];
                this._selected = [];
                this._uri = "";
                this._error = "";
                void this._browse();
            }
            else if (!this.open) {
                this._opened = false;
            }
        }
    }
    get _current() {
        return this._stack[this._stack.length - 1];
    }
    async _browse(node) {
        this._loading = true;
        this._error = "";
        try {
            const result = await browseMedia(this.hass, this.entityId, node?.media_content_id, node?.media_content_type);
            this._stack = node ? [...this._stack, result] : [result];
        }
        catch (err) {
            this._error = String(err);
        }
        finally {
            this._loading = false;
        }
    }
    _up(toIndex) {
        if (toIndex < this._stack.length - 1) {
            this._stack = this._stack.slice(0, toIndex + 1);
        }
    }
    _add(node) {
        const item = {
            media_content_id: node.media_content_id,
            media_content_type: node.media_content_type,
            title: node.title,
            thumbnail: node.thumbnail ?? null,
        };
        if (!this.multiple) {
            this._emitSelect([item]);
            return;
        }
        if (!this._selected.some((s) => s.media_content_id === item.media_content_id)) {
            this._selected = [...this._selected, item];
        }
    }
    _removeSelected(id) {
        this._selected = this._selected.filter((s) => s.media_content_id !== id);
    }
    _addUri() {
        const uri = this._uri.trim();
        if (!uri) {
            return;
        }
        const item = {
            media_content_id: uri,
            media_content_type: "music",
            title: uri,
        };
        if (!this.multiple) {
            this._emitSelect([item]);
            return;
        }
        if (!this._selected.some((s) => s.media_content_id === uri)) {
            this._selected = [...this._selected, item];
        }
        this._uri = "";
    }
    _confirm() {
        if (this._selected.length) {
            this._emitSelect(this._selected);
        }
    }
    _emitSelect(items) {
        this.dispatchEvent(new CustomEvent("select", { detail: { items } }));
        this._close();
    }
    _close() {
        this.open = false;
        this._opened = false;
        this.dispatchEvent(new CustomEvent("closed"));
    }
    render() {
        if (!this.open) {
            return A;
        }
        const lang = this.hass?.language;
        const cur = this._current;
        const children = cur?.children ?? [];
        return b `
      <div class="scrim" @click=${(e) => e.target === e.currentTarget && this._close()}>
        <div class="sheet">
          <div class="head">
            <h3>${localize(lang, "browser.title")}</h3>
            <button class="x" @click=${this._close} aria-label=${localize(lang, "common.cancel")}>✕</button>
          </div>

          ${this._stack.length
            ? b `<div class="crumbs">
                ${this._stack.map((node, i) => i === this._stack.length - 1
                ? b `<span>${this._crumb(node, lang)}</span>`
                : b `<button @click=${() => this._up(i)}>${this._crumb(node, lang)}</button><span class="sep">›</span>`)}
              </div>`
            : A}

          <div class="list">
            ${this._loading
            ? b `<div class="state">${localize(lang, "common.loading")}</div>`
            : this._error
                ? b `<div class="state">${this._error}</div>`
                : children.length
                    ? children.map((c) => this._row(c))
                    : b `<div class="state">${localize(lang, "browser.empty")}</div>`}
          </div>

          ${this.multiple && this._selected.length
            ? b `<div class="tray">
                ${this._selected.map((s) => b `<span class="pill" title=${s.media_content_id}>
                    <span>${s.title}</span>
                    <button @click=${() => this._removeSelected(s.media_content_id)}>✕</button>
                  </span>`)}
              </div>`
            : A}

          <div class="uri">
            <ha-selector
              .hass=${this.hass}
              .selector=${{ text: {} }}
              .label=${localize(lang, "browser.paste")}
              .value=${this._uri}
              @value-changed=${(e) => (this._uri = e.detail.value ?? "")}
            ></ha-selector>
            <ha-button appearance="outlined" ?disabled=${!this._uri.trim()} @click=${this._addUri}>
              ${localize(lang, "browser.paste_add")}
            </ha-button>
          </div>

          <div class="foot">
            <ha-button appearance="plain" @click=${this._close}>
              ${localize(lang, "common.cancel")}
            </ha-button>
            ${this.multiple
            ? b `<ha-button
                  appearance="plain"
                  variant="brand"
                  ?disabled=${!this._selected.length}
                  @click=${this._confirm}
                >
                  ${localize(lang, "browser.add_selected", { n: this._selected.length })}
                </ha-button>`
            : A}
          </div>
        </div>
      </div>
    `;
    }
    _crumb(node, lang) {
        return node.media_content_id ? node.title : localize(lang, "browser.root");
    }
    _row(node) {
        const thumb = node.thumbnail
            ? `background-image:url("${node.thumbnail}")`
            : "";
        const icon = node.can_expand ? "📁" : "🎵";
        const onRow = node.can_expand
            ? () => this._browse(node)
            : node.can_play
                ? () => this._add(node)
                : undefined;
        return b `
      <button class="row" @click=${onRow} ?disabled=${!onRow}>
        <span class="ic" style=${thumb}>${thumb ? "" : icon}</span>
        <span class="t" title=${node.media_content_id}>${node.title}</span>
        ${node.can_play && node.can_expand
            ? b `<span
              class="addbtn"
              role="button"
              @click=${(e) => {
                e.stopPropagation();
                this._add(node);
            }}
              >＋</span
            >`
            : A}
        ${node.can_expand ? b `<span class="chev">›</span>` : A}
      </button>
    `;
    }
};
AuroraMediaBrowser.styles = [
    auroraStyles,
    i$3 `
      .scrim {
        position: fixed;
        inset: 0;
        z-index: 20;
        background: rgba(0, 0, 0, 0.45);
        display: grid;
        place-items: center;
        padding: 16px;
      }
      .sheet {
        background: var(--aurora-surface);
        border: 1px solid var(--aurora-divider);
        border-radius: var(--aurora-radius);
        box-shadow: var(--aurora-shadow);
        width: min(560px, 100%);
        max-height: 86vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .head {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 16px 18px 10px;
      }
      .head h3 {
        margin: 0;
        font-size: 1.1rem;
        flex: 1;
      }
      .x {
        appearance: none;
        border: none;
        background: transparent;
        cursor: pointer;
        color: var(--aurora-dim);
        font-size: 20px;
        line-height: 1;
        padding: 4px;
      }
      .crumbs {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        padding: 0 18px 8px;
        font-size: 0.82rem;
        color: var(--aurora-dim);
      }
      .crumbs button {
        appearance: none;
        border: none;
        background: transparent;
        cursor: pointer;
        color: var(--aurora-accent);
        font: inherit;
        padding: 0;
      }
      .crumbs .sep {
        opacity: 0.5;
      }
      .list {
        overflow-y: auto;
        padding: 4px 10px;
        flex: 1;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 10px 8px;
        border-radius: 12px;
        cursor: pointer;
        appearance: none;
        border: none;
        background: transparent;
        color: var(--aurora-text);
        font: inherit;
        text-align: left;
      }
      .row:hover {
        background: color-mix(in srgb, var(--aurora-dim) 10%, transparent);
      }
      .row .ic {
        width: 34px;
        height: 34px;
        border-radius: 9px;
        display: grid;
        place-items: center;
        font-size: 17px;
        background: var(--aurora-grad-soft);
        flex: none;
        background-size: cover;
        background-position: center;
      }
      .row .t {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .row .addbtn {
        appearance: none;
        border: none;
        cursor: pointer;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: var(--aurora-accent-grad);
        color: var(--aurora-on-accent);
        font-size: 17px;
        line-height: 1;
        flex: none;
      }
      .row .chev {
        color: var(--aurora-dim);
        flex: none;
      }
      .uri {
        display: flex;
        gap: 8px;
        padding: 10px 18px;
        border-top: 1px solid var(--aurora-divider);
      }
      .uri input {
        flex: 1;
      }
      .tray {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 10px 18px 0;
      }
      .tray .pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 6px 5px 11px;
        border-radius: 999px;
        background: var(--aurora-accent-grad);
        color: var(--aurora-on-accent);
        font-size: 0.8rem;
        font-weight: 600;
        max-width: 100%;
      }
      .tray .pill span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .tray .pill button {
        appearance: none;
        border: none;
        cursor: pointer;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: color-mix(in srgb, var(--aurora-on-accent) 22%, transparent);
        color: var(--aurora-on-accent);
        font-size: 12px;
        line-height: 1;
        flex: none;
      }
      .foot {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 10px;
        padding: 12px 18px 16px;
      }
      .state {
        padding: 24px 18px;
        text-align: center;
        color: var(--aurora-dim);
      }
    `,
];
__decorate([
    n({ attribute: false })
], AuroraMediaBrowser.prototype, "hass", void 0);
__decorate([
    n({ attribute: false })
], AuroraMediaBrowser.prototype, "entityId", void 0);
__decorate([
    n({ type: Boolean })
], AuroraMediaBrowser.prototype, "open", void 0);
__decorate([
    n({ type: Boolean })
], AuroraMediaBrowser.prototype, "multiple", void 0);
__decorate([
    r()
], AuroraMediaBrowser.prototype, "_stack", void 0);
__decorate([
    r()
], AuroraMediaBrowser.prototype, "_loading", void 0);
__decorate([
    r()
], AuroraMediaBrowser.prototype, "_error", void 0);
__decorate([
    r()
], AuroraMediaBrowser.prototype, "_selected", void 0);
__decorate([
    r()
], AuroraMediaBrowser.prototype, "_uri", void 0);
AuroraMediaBrowser = __decorate([
    t("aurora-media-browser")
], AuroraMediaBrowser);

function genId() {
    return "p_" + Math.random().toString(36).slice(2, 10);
}
/**
 * Per-profile audio preset manager, embedded in the Setup Audio card.
 *
 * A preset is a named, reusable sound or ordered playlist built from Home
 * Assistant media (via aurora-media-browser) or pasted URIs, with drag-to-reorder
 * tracks (mouse + touch), shuffle and loop. Volume behaviour is set per alarm.
 * Presets are stored under options.profiles[userId].audio_presets and referenced
 * by an alarm's audio source as "aurora_preset:<id>".
 */
let AuroraAudioPresets = class AuroraAudioPresets extends i {
    constructor() {
        super(...arguments);
        this.userId = "";
        this.userName = "";
        /** The profile's bound speaker — gives the media browser its richest tree. */
        this.entityId = null;
        this._presets = [];
        this._editing = null;
        this._browserOpen = false;
        this._saving = false;
        this._loadedFor = "";
    }
    updated() {
        if (this.hass && this.userId && this._loadedFor !== this.userId) {
            this._loadedFor = this.userId;
            void this._load();
        }
    }
    async _load() {
        try {
            const settings = await getSettings(this.hass);
            const profiles = settings.options.profiles ?? {};
            this._presets = profiles[this.userId]?.audio_presets ?? [];
        }
        catch {
            this._presets = [];
        }
        this._editing = null;
    }
    /** Re-read settings before writing so we never clobber the profile bindings. */
    async _persist(presets) {
        this._saving = true;
        try {
            const settings = await getSettings(this.hass);
            const profiles = settings.options.profiles ?? {};
            const existing = profiles[this.userId] ?? { name: this.userName || this.userId, bindings: {} };
            profiles[this.userId] = {
                ...existing,
                name: this.userName || existing.name || this.userId,
                audio_presets: presets,
            };
            const res = await setSettings(this.hass, { profiles });
            const saved = res.options.profiles ?? profiles;
            this._presets = saved[this.userId]?.audio_presets ?? presets;
        }
        finally {
            this._saving = false;
        }
    }
    _new() {
        this._editing = { id: genId(), name: "", items: [], shuffle: false, loop: false };
    }
    _edit(preset) {
        this._editing = {
            ...preset,
            items: preset.items.map((i) => ({ ...i })),
        };
    }
    async _delete(preset) {
        await this._persist(this._presets.filter((p) => p.id !== preset.id));
    }
    _onBrowserSelect(e) {
        if (!this._editing) {
            return;
        }
        const have = new Set(this._editing.items.map((i) => i.media_content_id));
        const added = e.detail.items.filter((i) => !have.has(i.media_content_id));
        this._editing = { ...this._editing, items: [...this._editing.items, ...added] };
    }
    _removeItem(index) {
        if (!this._editing) {
            return;
        }
        this._editing = {
            ...this._editing,
            items: this._editing.items.filter((_, i) => i !== index),
        };
    }
    // --- Drag & drop reordering (ha-sortable: mouse + touch) ---------------
    _itemMoved(e) {
        e.stopPropagation();
        if (!this._editing) {
            return;
        }
        const { oldIndex, newIndex } = e.detail;
        const items = [...this._editing.items];
        const [moved] = items.splice(oldIndex, 1);
        items.splice(newIndex, 0, moved);
        this._editing = { ...this._editing, items };
    }
    // --- Playback behaviour ------------------------------------------------
    _toggleShuffle() {
        if (this._editing)
            this._editing = { ...this._editing, shuffle: !this._editing.shuffle };
    }
    _toggleLoop() {
        if (this._editing)
            this._editing = { ...this._editing, loop: !this._editing.loop };
    }
    async _saveEditing() {
        if (!this._editing) {
            return;
        }
        const editing = {
            ...this._editing,
            name: this._editing.name.trim() || localize(this.hass?.language, "presets.untitled"),
        };
        const exists = this._presets.some((p) => p.id === editing.id);
        const next = exists
            ? this._presets.map((p) => (p.id === editing.id ? editing : p))
            : [...this._presets, editing];
        await this._persist(next);
        this._editing = null;
    }
    render() {
        const lang = this.hass?.language;
        return b `
      <div class="ptop">
        <span class="h">${localize(lang, "presets.title")}</span>
        ${this._editing
            ? A
            : b `<ha-button appearance="outlined" size="small" @click=${this._new}>
              ${localize(lang, "presets.new")}
            </ha-button>`}
      </div>
      <div class="desc">
        ${localize(lang, "presets.desc", {
            name: this.userName || localize(lang, "devices.this_profile"),
        })}
      </div>
      ${this._editing ? this._renderEditor(lang) : this._renderList(lang)}
      <aurora-media-browser
        .hass=${this.hass}
        .entityId=${this.entityId}
        .open=${this._browserOpen}
        .multiple=${true}
        @select=${this._onBrowserSelect}
        @closed=${() => (this._browserOpen = false)}
      ></aurora-media-browser>
    `;
    }
    _renderList(lang) {
        if (!this._presets.length) {
            return b `<div class="empty">${localize(lang, "presets.empty")}</div>`;
        }
        return b `<div class="plist">
      ${this._presets.map((p) => b `<div class="prow">
          <span class="nm">${p.name}</span>
          <span class="badges">
            ${p.shuffle ? b `<ha-icon icon="mdi:shuffle-variant" title=${localize(lang, "presets.shuffle")}></ha-icon>` : A}
            ${p.loop ? b `<ha-icon icon="mdi:repeat" title=${localize(lang, "presets.loop")}></ha-icon>` : A}
            <span class="ct">${localize(lang, "presets.count", { n: p.items.length })}</span>
          </span>
          <button class="iconbtn" title=${localize(lang, "presets.edit")} @click=${() => this._edit(p)}>
            <ha-icon icon="mdi:pencil"></ha-icon>
          </button>
          <button class="iconbtn" title=${localize(lang, "common.delete")} ?disabled=${this._saving} @click=${() => this._delete(p)}>
            <ha-icon icon="mdi:delete-outline"></ha-icon>
          </button>
        </div>`)}
    </div>`;
    }
    _renderEditor(lang) {
        const ed = this._editing;
        return b `<div class="editor">
      <ha-selector
        .hass=${this.hass}
        .selector=${{ text: {} }}
        .label=${localize(lang, "presets.name")}
        .value=${ed.name}
        @value-changed=${(e) => (this._editing = { ...ed, name: e.detail.value ?? "" })}
      ></ha-selector>

      ${ed.items.length
            ? b `<ha-sortable handle-selector=".handle" @item-moved=${this._itemMoved}>
            <div class="items">
              ${ed.items.map((it, i) => this._renderItem(it, i))}
            </div>
          </ha-sortable>`
            : b `<div class="empty">${localize(lang, "presets.no_items")}</div>`}

      <div class="addrow">
        <ha-button appearance="outlined" size="small" @click=${() => (this._browserOpen = true)}>
          ${localize(lang, "presets.add_media")}
        </ha-button>
      </div>

      <div class="behaviour">
        <div class="barlabel">${localize(lang, "presets.playback")}</div>
        <div class="controls">
          <button
            class="ctrl ${ed.shuffle ? "on" : ""}"
            title=${localize(lang, "presets.shuffle")}
            aria-pressed=${ed.shuffle ? "true" : "false"}
            @click=${this._toggleShuffle}
          >
            <ha-icon icon="mdi:shuffle-variant"></ha-icon>
          </button>
          <button
            class="ctrl ${ed.loop ? "on" : ""}"
            title=${localize(lang, "presets.loop")}
            aria-pressed=${ed.loop ? "true" : "false"}
            @click=${this._toggleLoop}
          >
            <ha-icon icon="mdi:repeat"></ha-icon>
          </button>
        </div>
      </div>

      <div class="edfoot">
        <ha-button appearance="plain" @click=${() => (this._editing = null)}>
          ${localize(lang, "common.cancel")}
        </ha-button>
        <ha-button appearance="plain" variant="brand" ?disabled=${this._saving} @click=${this._saveEditing}>
          ${this._saving ? localize(lang, "common.saving") : localize(lang, "presets.save")}
        </ha-button>
      </div>
    </div>`;
    }
    _renderItem(it, i) {
        const thumb = it.thumbnail ? `background-image:url("${it.thumbnail}")` : "";
        return b `<div class="item">
      <span class="handle" title=${localize(this.hass?.language, "presets.drag")}>
        <ha-icon icon="mdi:drag-vertical"></ha-icon>
      </span>
      <span class="thumb" style=${thumb}>
        ${it.thumbnail ? A : b `<ha-icon icon="mdi:music-note"></ha-icon>`}
      </span>
      <span class="t" title=${it.media_content_id}>${it.title}</span>
      <span class="num">${i + 1}</span>
      <button class="iconbtn" @click=${() => this._removeItem(i)} title=${localize(this.hass?.language, "common.delete")}>
        <ha-icon icon="mdi:close"></ha-icon>
      </button>
    </div>`;
    }
};
AuroraAudioPresets.styles = [
    auroraStyles,
    i$3 `
      :host {
        display: block;
      }
      ha-icon {
        --mdc-icon-size: 20px;
      }
      .ptop {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 4px;
      }
      .ptop .h {
        font-weight: 600;
        flex: 1;
      }
      .desc {
        font-size: 0.8rem;
        color: var(--aurora-dim);
        margin: 2px 0 10px;
      }
      .plist {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .prow {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border: 1px solid var(--aurora-divider);
        border-radius: 12px;
      }
      .prow .nm {
        font-weight: 600;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .badges {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: var(--aurora-dim);
      }
      .badges ha-icon {
        --mdc-icon-size: 17px;
      }
      .badges .ct {
        font-size: 0.78rem;
      }
      .iconbtn {
        appearance: none;
        border: 1px solid var(--aurora-divider);
        background: transparent;
        cursor: pointer;
        border-radius: 9px;
        width: 34px;
        height: 34px;
        display: grid;
        place-items: center;
        color: var(--aurora-text);
        flex: none;
      }
      .iconbtn:hover {
        background: color-mix(in srgb, var(--aurora-dim) 10%, transparent);
      }
      .iconbtn:disabled {
        opacity: 0.35;
        cursor: default;
      }
      .empty {
        font-size: 0.82rem;
        color: var(--aurora-dim);
        font-style: italic;
        padding: 4px 0;
      }
      .editor {
        border: 1px solid var(--aurora-divider);
        border-radius: 14px;
        padding: 14px;
        background: color-mix(in srgb, var(--aurora-dim) 5%, transparent);
      }
      .items {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin: 12px 0;
      }
      .item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        border-radius: 10px;
        background: var(--aurora-surface);
        border: 1px solid var(--aurora-divider);
      }
      .item.dragging {
        opacity: 0.45;
      }
      .item.over {
        border-color: var(--aurora-accent);
        box-shadow: inset 0 2px 0 var(--aurora-accent);
      }
      .item .handle {
        cursor: grab;
        color: var(--aurora-dim);
        display: grid;
        place-items: center;
        flex: none;
      }
      .item .handle:active {
        cursor: grabbing;
      }
      .item .thumb {
        width: 34px;
        height: 34px;
        border-radius: 7px;
        flex: none;
        background: var(--aurora-grad-soft);
        background-size: cover;
        background-position: center;
        display: grid;
        place-items: center;
        color: var(--aurora-dim);
      }
      .item .t {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.85rem;
      }
      .item .num {
        font-size: 0.72rem;
        color: var(--aurora-dim);
        width: 16px;
        text-align: right;
        flex: none;
      }
      .addrow {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      /* Media-player-style behaviour bar */
      .behaviour {
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px solid var(--aurora-divider);
      }
      .barlabel {
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--aurora-dim);
        margin-bottom: 8px;
      }
      .controls {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .ctrl {
        appearance: none;
        border: 1px solid var(--aurora-divider);
        background: transparent;
        cursor: pointer;
        width: 42px;
        height: 42px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        color: var(--aurora-text);
        transition: background 0.15s, color 0.15s, border-color 0.15s;
      }
      .ctrl ha-icon {
        --mdc-icon-size: 22px;
      }
      .ctrl.on {
        background: var(--aurora-accent-grad);
        color: var(--aurora-on-accent);
        border-color: transparent;
      }
      .ctrl .lbl {
        display: none;
      }
      .edfoot {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 16px;
      }
    `,
];
__decorate([
    n({ attribute: false })
], AuroraAudioPresets.prototype, "hass", void 0);
__decorate([
    n({ attribute: false })
], AuroraAudioPresets.prototype, "userId", void 0);
__decorate([
    n({ attribute: false })
], AuroraAudioPresets.prototype, "userName", void 0);
__decorate([
    n({ attribute: false })
], AuroraAudioPresets.prototype, "entityId", void 0);
__decorate([
    r()
], AuroraAudioPresets.prototype, "_presets", void 0);
__decorate([
    r()
], AuroraAudioPresets.prototype, "_editing", void 0);
__decorate([
    r()
], AuroraAudioPresets.prototype, "_browserOpen", void 0);
__decorate([
    r()
], AuroraAudioPresets.prototype, "_saving", void 0);
AuroraAudioPresets = __decorate([
    t("aurora-audio-presets")
], AuroraAudioPresets);

// Roles grouped into themed cards (mirrors the Alarms page's card layout).
const GROUPS = [
    { key: "audio", icon: "🔊", roles: [{ key: "audio_sink", multiple: false }] },
    {
        key: "wake",
        icon: "🌅",
        roles: [
            { key: "wake_light", multiple: false },
            { key: "display_surface", multiple: true },
        ],
    },
    { key: "notify", icon: "🔔", roles: [{ key: "notify_channel", multiple: true }] },
    {
        key: "presence",
        icon: "😴",
        roles: [
            { key: "sleep_signal", multiple: true },
            { key: "presence_signal", multiple: true },
        ],
    },
    {
        key: "voice",
        icon: "🗣️",
        roles: [
            { key: "conversation", multiple: false },
            { key: "tts", multiple: false },
        ],
    },
];
/** Per-user device bindings editor. Edits options.profiles[userId].bindings. */
let AuroraDevicesView = class AuroraDevicesView extends i {
    constructor() {
        super(...arguments);
        this.userId = "";
        this.userName = "";
        this._bindings = {};
        this._saving = false;
        this._saved = false;
        this._profiles = {};
        this._loadedFor = "";
    }
    updated() {
        if (this.hass && this.userId && this._loadedFor !== this.userId) {
            this._loadedFor = this.userId;
            void this._load();
        }
    }
    async _load() {
        const [entities, settings] = await Promise.all([
            getRoleEntities(this.hass),
            getSettings(this.hass),
        ]);
        this._entities = entities;
        this._profiles = settings.options.profiles ?? {};
        this._bindings = { ...(this._profiles[this.userId]?.bindings ?? {}) };
        this._saved = false;
    }
    _set(key, value) {
        this._bindings = { ...this._bindings, [key]: value };
        this._saved = false;
    }
    async _save() {
        this._saving = true;
        try {
            const bindings = Object.fromEntries(Object.entries(this._bindings).filter(([, v]) => v !== "" && v !== null && !(Array.isArray(v) && v.length === 0)));
            // Re-read settings first so we preserve fields this view doesn't edit
            // (notably the profile's audio_presets, owned by the presets manager).
            const fresh = await getSettings(this.hass);
            const profiles = fresh.options.profiles ?? {};
            const existing = profiles[this.userId];
            profiles[this.userId] = {
                ...existing,
                name: this.userName || existing?.name || this.userId,
                bindings,
            };
            const res = await setSettings(this.hass, { profiles });
            this._profiles = res.options.profiles ?? profiles;
            this._saved = true;
        }
        finally {
            this._saving = false;
        }
    }
    render() {
        if (!this._entities) {
            return b `<div class="card intro">${localize(this.hass?.language, "devices.loading")}</div>`;
        }
        const lang = this.hass?.language;
        return b `
      <p class="intro">
        ${localize(lang, "devices.intro", {
            name: this.userName || localize(lang, "devices.this_profile"),
        })}
      </p>
      <div class="grid">${GROUPS.map((g) => this._card(g))}</div>
      <div class="savebar">
        <button class="btn primary" ?disabled=${this._saving} @click=${this._save}>
          ${this._saving ? localize(lang, "common.saving") : localize(lang, "devices.save")}
        </button>
        ${this._saved ? b `<span class="ok">${localize(lang, "common.saved")}</span>` : A}
      </div>
    `;
    }
    _card(group) {
        return b `
      <div class="card">
        <div class="cardhead">
          <div class="ic">${group.icon}</div>
          <h3>${localize(this.hass?.language, "setup.group." + group.key)}</h3>
        </div>
        ${group.roles.map((r) => this._role(r.key, r.multiple))}
        ${group.key === "audio" ? this._audioPresets() : A}
      </div>
    `;
    }
    _audioPresets() {
        const sink = this._bindings["audio_sink"];
        const entityId = typeof sink === "string" && sink ? sink : null;
        return b `
      <div class="role">
        <aurora-audio-presets
          .hass=${this.hass}
          .userId=${this.userId}
          .userName=${this.userName}
          .entityId=${entityId}
        ></aurora-audio-presets>
      </div>
    `;
    }
    _role(key, multiple) {
        const options = this._entities.roles[key] ?? [];
        const raw = this._bindings[key];
        // A multi role may still hold a legacy single-string binding (bound before
        // it became multiple) — coerce so it renders and round-trips instead of
        // silently dropping on save.
        const value = multiple
            ? Array.isArray(raw)
                ? raw
                : raw
                    ? [raw]
                    : []
            : (raw ?? "");
        return b `
      <div class="role">
        <div class="name">${localize(this.hass?.language, "role." + key + ".label")}</div>
        <div class="desc">${localize(this.hass?.language, "role." + key + ".desc")}</div>
        <aurora-entity-picker
          .hass=${this.hass}
          .options=${options}
          .value=${value}
          .multiple=${multiple}
          @change=${(e) => this._set(key, e.detail)}
        ></aurora-entity-picker>
      </div>
    `;
    }
};
AuroraDevicesView.styles = [
    auroraStyles,
    i$3 `
      .intro {
        color: var(--aurora-dim);
        margin: 0 0 16px;
        line-height: 1.5;
      }
      .who {
        font-weight: 700;
        color: var(--aurora-text);
      }
      /* Responsive card grid: 1 column on mobile, more on wider screens. */
      .grid {
        display: grid;
        gap: 14px;
        grid-template-columns: 1fr;
      }
      @media (min-width: 720px) {
        .grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      @media (min-width: 1200px) {
        .grid {
          grid-template-columns: repeat(3, 1fr);
        }
      }
      .card {
        background: var(--aurora-surface);
        border: 1px solid var(--aurora-divider);
        border-radius: var(--aurora-radius);
        padding: 18px 20px;
      }
      .cardhead {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 6px;
      }
      .cardhead h3 {
        margin: 0;
        font-size: 1.05rem;
        letter-spacing: 0.01em;
      }
      .ic {
        width: 38px;
        height: 38px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        font-size: 19px;
        background: var(--aurora-grad-soft);
        flex: none;
      }
      .role {
        padding: 14px 0 2px;
        border-top: 1px solid var(--aurora-divider);
        margin-top: 12px;
      }
      .role:first-of-type {
        border-top: none;
        margin-top: 6px;
      }
      .role .name {
        font-weight: 600;
      }
      .role .desc {
        font-size: 0.8rem;
        color: var(--aurora-dim);
        margin-bottom: 10px;
      }
      .savebar {
        position: sticky;
        bottom: 0;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 2px 4px;
        margin-top: 4px;
        background: linear-gradient(transparent, var(--primary-background-color) 45%);
      }
      .ok {
        color: var(--aurora-accent);
        font-weight: 600;
      }
    `,
];
__decorate([
    n({ attribute: false })
], AuroraDevicesView.prototype, "hass", void 0);
__decorate([
    n({ attribute: false })
], AuroraDevicesView.prototype, "userId", void 0);
__decorate([
    n({ attribute: false })
], AuroraDevicesView.prototype, "userName", void 0);
__decorate([
    r()
], AuroraDevicesView.prototype, "_entities", void 0);
__decorate([
    r()
], AuroraDevicesView.prototype, "_bindings", void 0);
__decorate([
    r()
], AuroraDevicesView.prototype, "_saving", void 0);
__decorate([
    r()
], AuroraDevicesView.prototype, "_saved", void 0);
AuroraDevicesView = __decorate([
    t("aurora-devices-view")
], AuroraDevicesView);

/** Reference docs for the two supported wake-up vision providers. */
const AI_TASK_DOCS = "https://www.home-assistant.io/integrations/ai_task/";
const LLM_VISION_REPO = "https://github.com/valentinfrlch/ha-llmvision";
/** Shared, installation-wide settings (not per-user). */
let AuroraGlobalsView = class AuroraGlobalsView extends i {
    constructor() {
        super(...arguments);
        this._options = {};
        this._saving = false;
        this._saved = false;
        this._loaded = false;
    }
    updated() {
        if (this.hass && !this._loaded) {
            this._loaded = true;
            void this._load();
        }
    }
    async _load() {
        const [entities, settings] = await Promise.all([
            getRoleEntities(this.hass),
            getSettings(this.hass),
        ]);
        this._entities = entities;
        this._options = { ...settings.options };
    }
    _setOption(key, value) {
        this._options = { ...this._options, [key]: value };
        this._saved = false;
    }
    async _save() {
        this._saving = true;
        try {
            const res = await setSettings(this.hass, {
                ring_max_duration: this._options["ring_max_duration"] ?? 600,
                skip_calendars: this._options["skip_calendars"] ?? [],
                holiday_calendars: this._options["holiday_calendars"] ?? [],
                weather: this._options["weather"] ?? "",
                briefing_calendars: this._options["briefing_calendars"] ?? [],
                todo_lists: this._options["todo_lists"] ?? [],
                vision_provider: this._options["vision_provider"] ?? "",
            });
            this._options = { ...res.options };
            this._saved = true;
        }
        catch (err) {
            this._saved = false;
            throw err;
        }
        finally {
            this._saving = false;
        }
    }
    render() {
        if (!this._entities) {
            return b `<div class="intro">${localize(this.hass?.language, "common.loading")}</div>`;
        }
        const ringMin = Math.round(Number(this._options["ring_max_duration"] ?? 600) / 60);
        return b `
      <p class="intro">${localize(this.hass?.language, "globals.intro")}</p>

      <div class="block">
        <label class="field">${localize(this.hass?.language, "globals.ring_max")}</label>
        <input
          type="number"
          min="1"
          max="60"
          style="max-width:140px"
          .value=${String(ringMin)}
          @input=${(e) => {
            this._options = {
                ...this._options,
                ring_max_duration: Number(e.target.value) * 60,
            };
            this._saved = false;
        }}
        />
      </div>

      ${this._calendars("skip_calendars", localize(this.hass?.language, "globals.skip_calendars"))}
      ${this._calendars("holiday_calendars", localize(this.hass?.language, "globals.holiday_calendars"))}

      <p class="intro" style="margin-top:22px">
        ${localize(this.hass?.language, "globals.briefing_intro")}
      </p>
      ${this._picker("weather", localize(this.hass?.language, "globals.weather"), this._entities.weather ?? [], false)}
      ${this._picker("briefing_calendars", localize(this.hass?.language, "globals.briefing_calendars"), this._entities.calendars ?? [], true)}
      ${this._picker("todo_lists", localize(this.hass?.language, "globals.todo_lists"), this._entities.todo ?? [], true)}

      ${this._visionSection()}

      <div class="savebar">
        <button class="btn primary" ?disabled=${this._saving} @click=${this._save}>
          ${this._saving ? localize(this.hass?.language, "common.saving") : localize(this.hass?.language, "globals.save")}
        </button>
        ${this._saved ? b `<span class="ok">${localize(this.hass?.language, "common.saved")}</span>` : A}
      </div>
    `;
    }
    _visionSection() {
        const lang = this.hass?.language;
        const aiTasks = this._entities.roles?.["vision_provider"] ?? [];
        const llm = this._entities.vision_providers ?? [];
        const bound = this._options["vision_provider"] || "";
        let active;
        if (bound) {
            const name = this.hass?.states[bound]?.attributes?.friendly_name || bound;
            active = localize(lang, "globals.vision_active_aitask", { name });
        }
        else if (llm.length) {
            active = localize(lang, "globals.vision_active_llm", {
                names: llm.map((p) => p.title).join(", "),
            });
        }
        else {
            active = localize(lang, "globals.vision_active_none");
        }
        return b `
      <p class="intro" style="margin-top:22px">${localize(lang, "globals.vision_intro")}</p>
      ${this._picker("vision_provider", localize(lang, "globals.vision_provider"), aiTasks, false)}
      <div class="detected">${active}</div>
      <div class="refs">
        <a href=${AI_TASK_DOCS} target="_blank" rel="noopener noreferrer">
          ↗ ${localize(lang, "globals.vision_ref_aitask")}
        </a>
        <a href=${LLM_VISION_REPO} target="_blank" rel="noopener noreferrer">
          ↗ ${localize(lang, "globals.vision_ref_llm")}
        </a>
      </div>
    `;
    }
    _calendars(key, label) {
        return this._picker(key, label, this._entities.calendars ?? [], true);
    }
    _picker(key, label, options, multiple) {
        return b `
      <div class="block">
        <label class="field">${label}</label>
        <aurora-entity-picker
          .hass=${this.hass}
          .options=${options}
          .value=${multiple
            ? (this._options[key] ?? [])
            : (this._options[key] ?? "")}
          .multiple=${multiple}
          @change=${(e) => this._setOption(key, e.detail)}
        ></aurora-entity-picker>
      </div>
    `;
    }
};
AuroraGlobalsView.styles = [
    auroraStyles,
    i$3 `
      .intro {
        color: var(--aurora-dim);
        margin: 0 0 18px;
        line-height: 1.5;
      }
      .block {
        padding: 14px 0;
        border-top: 1px solid var(--aurora-divider);
      }
      .block .field {
        margin-bottom: 8px;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .chip {
        appearance: none;
        border: 1px solid var(--aurora-divider);
        cursor: pointer;
        font: inherit;
        font-size: 0.85rem;
        padding: 8px 12px;
        border-radius: 999px;
        background: transparent;
        color: var(--aurora-dim);
      }
      .chip.on {
        color: var(--aurora-on-accent);
        background: var(--aurora-accent-grad);
        border-color: transparent;
      }
      .none {
        font-size: 0.85rem;
        color: var(--aurora-dim);
        font-style: italic;
      }
      .detected {
        font-size: 0.85rem;
        color: var(--aurora-dim);
        margin-top: 8px;
        line-height: 1.5;
      }
      .detected b {
        color: var(--aurora-text);
        font-weight: 600;
      }
      .refs {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 16px;
        margin-top: 12px;
      }
      .refs a {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        color: var(--aurora-accent);
        font-size: 0.83rem;
        font-weight: 600;
        text-decoration: none;
      }
      .refs a:hover {
        text-decoration: underline;
      }
      .savebar {
        display: flex;
        align-items: center;
        gap: 12px;
        padding-top: 16px;
      }
      .ok {
        color: var(--aurora-accent);
        font-weight: 600;
      }
    `,
];
__decorate([
    n({ attribute: false })
], AuroraGlobalsView.prototype, "hass", void 0);
__decorate([
    r()
], AuroraGlobalsView.prototype, "_entities", void 0);
__decorate([
    r()
], AuroraGlobalsView.prototype, "_options", void 0);
__decorate([
    r()
], AuroraGlobalsView.prototype, "_saving", void 0);
__decorate([
    r()
], AuroraGlobalsView.prototype, "_saved", void 0);
AuroraGlobalsView = __decorate([
    t("aurora-globals-view")
], AuroraGlobalsView);

const ALL = "__all__";
let AuroraPanel = class AuroraPanel extends i {
    constructor() {
        super(...arguments);
        this.narrow = false;
        this._tab = "alarms";
        this._selected = "";
        this._profiles = {};
        this._loaded = false;
    }
    updated() {
        // The ring route renders only the info-only overlay; it never reads
        // profiles, so skip the settings fetch entirely on a pushed display.
        if (this.route?.path === "/ring")
            return;
        if (this.hass && !this._loaded) {
            this._loaded = true;
            this._selected = this.hass.user?.id ?? "";
            void this._loadProfiles();
        }
    }
    async _loadProfiles() {
        try {
            const settings = await getSettings(this.hass);
            this._profiles = settings.options.profiles ?? {};
        }
        catch {
            this._profiles = {};
        }
    }
    get _isAdmin() {
        return this.hass.user?.is_admin ?? false;
    }
    get _names() {
        const me = this.hass.user;
        const names = {};
        for (const [id, p] of Object.entries(this._profiles))
            names[id] = p.name || id;
        if (me)
            names[me.id] = me.name;
        return names;
    }
    get _selectedName() {
        if (this._selected === ALL)
            return localize(this.hass?.language, "panel.all");
        return this._names[this._selected] ?? this.hass.user?.name ?? localize(this.hass?.language, "panel.profile");
    }
    render() {
        if (!this.hass)
            return b `${A}`;
        if (this.route?.path === "/ring") {
            return b `<aurora-ring-display .hass=${this.hass}></aurora-ring-display>`;
        }
        const initial = (this._selectedName[0] ?? "A").toUpperCase();
        return b `
      <div class="bar">
        <div class="brand"><span>🌅</span><span class="grad-text">Aurora</span></div>
        <div class="who">
          ${this._isAdmin
            ? b `<select
                .value=${this._selected}
                @change=${(e) => (this._selected = e.target.value)}
              >
                ${Object.entries(this._names).map(([id, name]) => b `<option value=${id} ?selected=${id === this._selected}>
                    ${name}
                  </option>`)}
                <option value=${ALL} ?selected=${this._selected === ALL}>${localize(this.hass?.language, "panel.all")}</option>
              </select>`
            : b `<span>${this._selectedName}</span>`}
          <div class="avatar">${initial}</div>
        </div>
      </div>

      <div class="tabs">
        <button class="tab ${this._tab === "alarms" ? "on" : ""}" @click=${() => (this._tab = "alarms")}>
          ${localize(this.hass?.language, "panel.tab_alarms")}
        </button>
        <button class="tab ${this._tab === "devices" ? "on" : ""}" @click=${() => (this._tab = "devices")}>
          ${localize(this.hass?.language, "panel.tab_devices")}
        </button>
        <button class="tab ${this._tab === "globals" ? "on" : ""}" @click=${() => (this._tab = "globals")}>
          ${localize(this.hass?.language, "panel.tab_globals")}
        </button>
      </div>

      <div class="content ${this._tab === "globals" ? "" : "wide"}">
        ${this._tab === "alarms"
            ? this._alarmsTab()
            : this._tab === "devices"
                ? this._setupTab()
                : b `<div class="panel-card">
                <aurora-globals-view .hass=${this.hass}></aurora-globals-view>
              </div>`}
      </div>
    `;
    }
    _alarmsTab() {
        const profileId = this._selected === ALL ? null : this._selected;
        const showAll = this._selected === ALL;
        return b `
      <aurora-schedule-card
        .hass=${this.hass}
        .profileId=${profileId}
        .showAll=${showAll}
      ></aurora-schedule-card>
      <aurora-alarm-list
        .hass=${this.hass}
        .profileId=${profileId}
        .showAll=${showAll}
      ></aurora-alarm-list>
    `;
    }
    _setupTab() {
        if (this._selected === ALL) {
            return b `<div class="panel-card">
        <div class="hint">${localize(this.hass?.language, "panel.select_profile")}</div>
      </div>`;
        }
        return b `<aurora-devices-view
      .hass=${this.hass}
      .userId=${this._selected}
      .userName=${this._selectedName}
    ></aurora-devices-view>`;
    }
};
AuroraPanel.styles = [
    auroraStyles,
    i$3 `
      :host {
        display: block;
        min-height: 100vh;
        background: var(--primary-background-color, #f3f3f7);
      }
      .bar {
        position: sticky;
        top: 0;
        z-index: 4;
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 18px 22px 6px;
        background: var(--primary-background-color, #f3f3f7);
      }
      .brand {
        font-size: 1.5rem;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .who {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--aurora-dim);
        font-weight: 600;
      }
      .who select {
        width: auto;
        padding: 6px 34px 6px 12px;
      }
      .avatar {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: var(--aurora-grad);
        color: #fff;
        display: grid;
        place-items: center;
        font-weight: 700;
        font-size: 0.85rem;
      }
      .tabs {
        display: flex;
        gap: 6px;
        padding: 8px 22px 0;
        position: sticky;
        top: 60px;
        background: var(--primary-background-color, #f3f3f7);
        z-index: 4;
        flex-wrap: wrap;
      }
      .tab {
        appearance: none;
        border: none;
        cursor: pointer;
        font: inherit;
        font-weight: 600;
        padding: 10px 16px;
        border-radius: 999px;
        color: var(--aurora-dim);
        background: transparent;
      }
      .tab.on {
        color: var(--aurora-text);
        background: var(--aurora-surface);
        box-shadow: var(--aurora-shadow);
      }
      .content {
        max-width: 760px;
        margin: 0 auto;
        padding: 18px 18px 80px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      /* The Alarms tab uses the full width on tablet/desktop. */
      .content.wide {
        width: 100%;
      }
      @media (min-width: 900px) {
        .content.wide {
          max-width: 1000px;
        }
      }
      @media (min-width: 1200px) {
        .content.wide {
          max-width: 1200px;
        }
      }
      .panel-card {
        background: var(--aurora-surface);
        border-radius: var(--aurora-radius);
        padding: 20px;
        border: 1px solid var(--aurora-divider);
      }
      .hint {
        color: var(--aurora-dim);
        padding: 8px 2px;
      }
    `,
];
__decorate([
    n({ attribute: false })
], AuroraPanel.prototype, "hass", void 0);
__decorate([
    n({ attribute: false })
], AuroraPanel.prototype, "route", void 0);
__decorate([
    n({ type: Boolean })
], AuroraPanel.prototype, "narrow", void 0);
__decorate([
    r()
], AuroraPanel.prototype, "_tab", void 0);
__decorate([
    r()
], AuroraPanel.prototype, "_selected", void 0);
__decorate([
    r()
], AuroraPanel.prototype, "_profiles", void 0);
AuroraPanel = __decorate([
    t("aurora-panel")
], AuroraPanel);

/**
 * Aurora frontend bundle entry.
 *
 * Defines two custom elements from one module:
 *  - <aurora-card>  : the dashboard card (auto-registered in the card picker)
 *  - <aurora-panel> : the full-page sidebar app
 * The integration serves this file and loads it via frontend.add_extra_js_url
 * (card) and panel_custom (panel).
 */
const w = window;
w.customCards = w.customCards ?? [];
if (!w.customCards.some((c) => c.type === "aurora-card")) {
    w.customCards.push({
        type: "aurora-card",
        name: "Aurora",
        description: "Smart modular alarm clock — manage alarms, devices and the ring screen.",
        preview: true,
        documentationURL: "https://github.com/BBriele/aurora",
    });
}
// eslint-disable-next-line no-console
console.info("%c AURORA %c smart alarm ", "background:#5b3f9d;color:#fff;border-radius:4px 0 0 4px;padding:2px 6px", "background:#e89a4b;color:#2a1840;border-radius:0 4px 4px 0;padding:2px 6px");
