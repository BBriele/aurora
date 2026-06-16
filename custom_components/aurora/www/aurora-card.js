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
 * Shared "Dawn" design tokens + primitives. Base colours come from the user's
 * Home Assistant theme (CSS variables) so Aurora always feels native in light or
 * dark; the signature sunrise gradient is the one bold, memorable accent.
 */
const auroraStyles = i$3 `
  :host {
    --aurora-grad: linear-gradient(135deg, #232554 0%, #5b3f9d 44%, #e89a4b 100%);
    --aurora-grad-soft: linear-gradient(
      135deg,
      rgba(91, 63, 157, 0.16),
      rgba(232, 154, 75, 0.14)
    );
    --aurora-accent: var(--primary-color, #6d4aa7);
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
    color: #fff;
    background: var(--aurora-grad);
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
    background: color-mix(in srgb, var(--aurora-dim) 8%, transparent);
    border: 1px solid var(--aurora-divider);
    border-radius: var(--aurora-radius-sm);
    padding: 10px 12px;
    width: 100%;
  }
  input:focus,
  select:focus {
    outline: 2px solid color-mix(in srgb, var(--aurora-accent) 55%, transparent);
    outline-offset: 1px;
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
    background: var(--aurora-grad);
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

const WEEKDAY_LETTERS = ["L", "M", "M", "G", "V", "S", "D"];
const ROLE_LABELS = {
    audio_sink: "Altoparlante",
    wake_light: "Luce / schermo (alba)",
    display_surface: "Superficie display",
    notify_channel: "Notifiche",
    sleep_signal: "Segnali di sonno",
    presence_signal: "Segnali di presenza",
    conversation: "Agente vocale",
    tts: "Sintesi vocale",
};
const ROLE_DESC = {
    audio_sink: "Dove suona la sveglia",
    wake_light: "Luce o schermo per la rampa alba",
    display_surface: "Schermo che mostra la schermata sveglia",
    notify_channel: "Dove arrivano le notifiche (telefono, watch, overlay…)",
    sleep_signal: "Sensori che capiscono se stai dormendo (watch, materasso…)",
    presence_signal: "Sensori che capiscono se sei presente / sveglio",
    conversation: "Assistente vocale per i comandi",
    tts: "Voce per briefing e annunci",
};
const ROLE_ICONS = {
    audio_sink: "🔊",
    wake_light: "🌅",
    display_surface: "🖥️",
    notify_channel: "🔔",
    sleep_signal: "😴",
    presence_signal: "🚶",
    conversation: "🗣️",
    tts: "📣",
};
const MISSION_LABELS = {
    none: "Nessuna",
    tap: "Tocco",
    math: "Matematica",
    qr: "Codice QR",
    shake: "Scuoti",
    open_door: "Apri porta",
    vision: "Selfie (AI)",
};

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
        ${WEEKDAY_LETTERS.map((letter, i) => b `
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
        color: #fff;
        background: var(--aurora-grad);
        box-shadow: var(--aurora-shadow);
      }
    `,
];
__decorate([
    n({ attribute: false })
], AuroraWeekdayChips.prototype, "value", void 0);
AuroraWeekdayChips = __decorate([
    t("aurora-weekday-chips")
], AuroraWeekdayChips);

const REPEATS = [
    { value: "once", label: "Una volta" },
    { value: "daily", label: "Ogni giorno" },
    { value: "weekly", label: "Settimanale" },
];
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
        this._snoozeMax = 3;
        this._snoozeMin = 9;
        this._audioSource = "";
        this._audioFade = true;
        this._light = false;
        this._lightMin = 30;
        this._enabled = true;
        this._saving = false;
    }
    willUpdate(changed) {
        if (changed.has("open") && this.open) {
            this._populate();
        }
    }
    _populate() {
        const a = this.alarm;
        this._time = a?.time ?? "07:00";
        this._label = a?.label ?? "";
        this._repeat = a?.schedule.repeat_mode ?? "daily";
        this._days = a?.schedule.weekdays?.length ? [...a.schedule.weekdays] : [0, 1, 2, 3, 4];
        this._mission = a?.features.mission.type ?? "tap";
        this._snoozeMax = a?.features.snooze.max ?? 3;
        this._snoozeMin = a ? Math.round((a.features.snooze.duration ?? 540) / 60) : 9;
        this._audioSource = a?.features.audio.source ?? "";
        this._audioFade = a ? a.features.audio.volume_profile === "fade_in" : true;
        this._light = a?.features.light.enabled ?? false;
        this._lightMin = a?.features.light.duration_min ?? 30;
        this._enabled = a?.enabled ?? true;
        this._saving = false;
    }
    _close() {
        this.open = false;
        this.dispatchEvent(new CustomEvent("closed"));
    }
    async _save() {
        this._saving = true;
        const input = {
            time: this._time,
            label: this._label,
            profile_id: this.alarm?.profile_id ?? this.profileId,
            enabled: this._enabled,
            schedule: { repeat_mode: this._repeat, weekdays: this._days },
            features: {
                mission: { type: this._mission },
                snooze: { max: this._snoozeMax, duration: this._snoozeMin * 60 },
                audio: {
                    enabled: this._audioSource !== "",
                    source: this._audioSource || null,
                    volume_profile: this._audioFade ? "fade_in" : "fixed",
                    volume_max: 0.7,
                },
                light: { enabled: this._light, duration_min: this._lightMin, post_stop: "off" },
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
            // eslint-disable-next-line no-alert
            this.dispatchEvent(new CustomEvent("error", { detail: String(err), bubbles: true, composed: true }));
        }
    }
    render() {
        if (!this.open) {
            return A;
        }
        return b `
      <div class="backdrop" @click=${(e) => e.target === e.currentTarget && this._close()}>
        <div class="sheet">
          <div class="grip"></div>
          <h2>${this.alarm ? "Modifica sveglia" : "Nuova sveglia"}</h2>
          <input
            class="big-time clock"
            type="time"
            .value=${this._time}
            @input=${(e) => (this._time = e.target.value)}
          />

          <label class="field">Etichetta</label>
          <input
            type="text"
            placeholder="Es. Sveglia lavoro"
            .value=${this._label}
            @input=${(e) => (this._label = e.target.value)}
          />

          <div class="block">
            <label class="field">Ripetizione</label>
            <div class="seg">
              ${REPEATS.map((r) => b `
                  <button
                    class=${this._repeat === r.value ? "on" : ""}
                    @click=${() => (this._repeat = r.value)}
                  >
                    ${r.label}
                  </button>
                `)}
            </div>
          </div>

          ${this._repeat === "weekly"
            ? b `<div class="block">
                <label class="field">Giorni</label>
                <aurora-weekday-chips
                  .value=${this._days}
                  @change=${(e) => (this._days = e.detail)}
                ></aurora-weekday-chips>
              </div>`
            : A}

          <div class="block grid2">
            <div>
              <label class="field">Missione anti-snooze</label>
              <select
                .value=${this._mission}
                @change=${(e) => (this._mission = e.target.value)}
              >
                ${Object.keys(MISSION_LABELS).map((m) => b `<option value=${m} ?selected=${m === this._mission}>
                    ${MISSION_LABELS[m]}
                  </option>`)}
              </select>
            </div>
            <div>
              <label class="field">Suono (URI/playlist)</label>
              <input
                type="text"
                placeholder="opzionale"
                .value=${this._audioSource}
                @input=${(e) => (this._audioSource = e.target.value)}
              />
            </div>
          </div>

          <div class="block grid2">
            <div>
              <label class="field">Max snooze</label>
              <input
                type="number"
                min="0"
                max="10"
                .value=${String(this._snoozeMax)}
                @input=${(e) => (this._snoozeMax = Number(e.target.value))}
              />
            </div>
            <div>
              <label class="field">Durata snooze (min)</label>
              <input
                type="number"
                min="1"
                max="60"
                .value=${String(this._snoozeMin)}
                @input=${(e) => (this._snoozeMin = Number(e.target.value))}
              />
            </div>
          </div>

          <div class="togglerow">
            <div
              class="switch"
              role="switch"
              aria-checked=${this._audioFade ? "true" : "false"}
              @click=${() => (this._audioFade = !this._audioFade)}
            ></div>
            <div>Volume crescente (fade-in)</div>
          </div>
          <div class="togglerow">
            <div
              class="switch"
              role="switch"
              aria-checked=${this._light ? "true" : "false"}
              @click=${() => (this._light = !this._light)}
            ></div>
            <div class="spacer">Alba (rampa luce/schermo)</div>
            ${this._light
            ? b `<input
                  style="width:90px"
                  type="number"
                  min="1"
                  max="60"
                  .value=${String(this._lightMin)}
                  @input=${(e) => (this._lightMin = Number(e.target.value))}
                />`
            : A}
          </div>

          <div class="actions">
            <button class="btn ghost" @click=${this._close}>Annulla</button>
            <button class="btn primary" ?disabled=${this._saving} @click=${this._save}>
              ${this._saving ? "Salvataggio…" : "Salva"}
            </button>
          </div>
        </div>
      </div>
    `;
    }
};
AuroraAlarmDialog.styles = [
    auroraStyles,
    i$3 `
      .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(20, 18, 40, 0.55);
        backdrop-filter: blur(4px);
        display: grid;
        place-items: end center;
        z-index: 9;
        animation: fade 0.2s ease;
      }
      @media (min-width: 600px) {
        .backdrop {
          place-items: center;
        }
      }
      .sheet {
        width: min(560px, 100%);
        max-height: 92vh;
        overflow: auto;
        background: var(--aurora-surface);
        border-radius: 26px 26px 0 0;
        padding: 8px 22px 22px;
        box-shadow: 0 -20px 60px -20px rgba(20, 18, 40, 0.6);
        animation: rise 0.28s cubic-bezier(0.2, 0.9, 0.3, 1);
      }
      @media (min-width: 600px) {
        .sheet {
          border-radius: 26px;
        }
      }
      .grip {
        width: 42px;
        height: 5px;
        border-radius: 3px;
        background: var(--aurora-divider);
        margin: 8px auto 14px;
      }
      h2 {
        margin: 0 0 4px;
        font-size: 1.25rem;
      }
      .big-time {
        width: 100%;
        font-size: 3.2rem;
        text-align: center;
        border: none;
        background: transparent;
        padding: 4px 0 10px;
      }
      .big-time:focus {
        outline: none;
      }
      .grid2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
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
        color: #fff;
        background: var(--aurora-grad);
      }
      .block {
        margin-top: 18px;
      }
      .togglerow {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 0;
        border-top: 1px solid var(--aurora-divider);
      }
      .actions {
        display: flex;
        gap: 12px;
        margin-top: 22px;
      }
      .actions .btn {
        flex: 1;
        padding: 14px;
      }
      @keyframes fade {
        from {
          opacity: 0;
        }
      }
      @keyframes rise {
        from {
          transform: translateY(40px);
          opacity: 0;
        }
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
], AuroraAlarmDialog.prototype, "_snoozeMax", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_snoozeMin", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_audioSource", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_audioFade", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_light", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_lightMin", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_enabled", void 0);
__decorate([
    r()
], AuroraAlarmDialog.prototype, "_saving", void 0);
AuroraAlarmDialog = __decorate([
    t("aurora-alarm-dialog")
], AuroraAlarmDialog);

function summarize(alarm) {
    const s = alarm.schedule;
    if (s.repeat_mode === "daily")
        return "Ogni giorno";
    if (s.repeat_mode === "once")
        return s.on_date ? `Il ${s.on_date}` : "Una volta";
    if (!s.weekdays?.length)
        return "Mai";
    if (s.weekdays.length === 7)
        return "Ogni giorno";
    return s.weekdays.map((d) => WEEKDAY_LETTERS[d]).join(" ");
}
let AuroraAlarmList = class AuroraAlarmList extends i {
    constructor() {
        super(...arguments);
        /** When set, only show (and create) alarms for this profile. */
        this.profileId = null;
        this.showAll = false;
        this._alarms = [];
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
        this._unsub = subscribeAlarms(this.hass, (alarms) => (this._alarms = alarms));
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
      <div class="head">
        <h3>Sveglie</h3>
        <span class="spacer"></span>
        <button class="btn primary" @click=${this._add}>+ Nuova</button>
      </div>

      ${visible.length === 0
            ? b `<div class="empty">
            <div class="big">🌙</div>
            Nessuna sveglia. Tocca <b>+ Nuova</b> per crearne una.
          </div>`
            : b `<div class="list">
            ${visible.map((a) => this._row(a))}
          </div>`}

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
            ${a.label || "Sveglia"}${a.skip_next
            ? b `<span class="badge">salta 1</span>`
            : A}
          </div>
          <div class="when">${summarize(a)}</div>
        </div>
        <span class="spacer"></span>
        <button
          class="icon-btn"
          title="Salta la prossima"
          @click=${(e) => {
            e.stopPropagation();
            updateAlarm(this.hass, a.id, { skip_next: !a.skip_next });
        }}
        >
          ${a.skip_next ? "⏭" : "⤼"}
        </button>
        <button
          class="icon-btn"
          title="Elimina"
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
      .list {
        display: flex;
        flex-direction: column;
        gap: 10px;
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
], AuroraAlarmList.prototype, "_editing", void 0);
__decorate([
    r()
], AuroraAlarmList.prototype, "_dialogOpen", void 0);
AuroraAlarmList = __decorate([
    t("aurora-alarm-list")
], AuroraAlarmList);

let AuroraRingOverlay = class AuroraRingOverlay extends i {
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
    get _ringing() {
        return this.hass?.states["binary_sensor.aurora_ringing"]?.state === "on";
    }
    render() {
        if (!this._ringing)
            return A;
        const hh = String(this._now.getHours()).padStart(2, "0");
        const mm = String(this._now.getMinutes()).padStart(2, "0");
        return b `
      <div class="overlay">
        <div class="sky"></div>
        <div class="sun"></div>
        <div class="content">
          <div class="big clock">${hh}:${mm}</div>
          <div class="label">È ora di alzarsi</div>
          <div class="actions">
            <button class="big-btn snooze" @click=${() => ringAction(this.hass, "snooze")}>
              Posponi
            </button>
            <button class="big-btn stop" @click=${() => ringAction(this.hass, "dismiss")}>
              Stop
            </button>
          </div>
        </div>
      </div>
    `;
    }
};
AuroraRingOverlay.styles = [
    auroraStyles,
    i$3 `
      .overlay {
        position: fixed;
        inset: 0;
        z-index: 20;
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
AuroraRingOverlay = __decorate([
    t("aurora-ring-overlay")
], AuroraRingOverlay);

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
        return { title: "Aurora" };
    }
    _hero() {
        const next = this.hass?.states["sensor.aurora_next_alarm"];
        const valid = next && next.state && !["unknown", "unavailable"].includes(next.state);
        let time = "—";
        let sub = "Nessuna sveglia programmata";
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
        <div class="hero-k">Prossima sveglia</div>
        <div class="hero-time clock">${time}</div>
        <div class="hero-sub">${sub}</div>
      </div>
    `;
    }
    _relative(dt) {
        const diff = dt.getTime() - Date.now();
        if (diff <= 0)
            return "ora";
        const mins = Math.round(diff / 60000);
        if (mins < 60)
            return `tra ${mins} min`;
        const hrs = Math.floor(mins / 60);
        const rem = mins % 60;
        if (hrs < 24)
            return `tra ${hrs}h${rem ? ` ${rem}m` : ""}`;
        const days = Math.round(hrs / 24);
        return `tra ${days} ${days === 1 ? "giorno" : "giorni"}`;
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
            <a class="open" href="/aurora">Apri l'app Aurora →</a>
          </div>
        </div>
      </ha-card>
      <aurora-ring-overlay .hass=${this.hass}></aurora-ring-overlay>
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
        color: #fff;
        background: var(--aurora-grad);
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
        background: radial-gradient(circle, rgba(255, 240, 200, 0.5), transparent 70%);
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
 * Friendly entity picker used for role bindings.
 * - single: a dropdown of friendly names (+ "Nessuno").
 * - multiple: chosen entities as removable pills + a searchable "Aggiungi…"
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
            return b `<div class="none">Nessuna entità compatibile trovata.</div>`;
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
        <option value="" ?selected=${value === ""}>— Nessuno —</option>
        ${this._sorted(this.options).map((id) => b `<option value=${id} ?selected=${id === value} title=${id}>
            ${this._name(id)}
          </option>`)}
      </select>
    `;
    }
    _renderMulti() {
        const value = this.value ?? [];
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
              <option value="">＋ Aggiungi…</option>
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
        color: #fff;
        background: var(--aurora-grad);
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
        background: rgba(255, 255, 255, 0.25);
        color: #fff;
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

const ROLES = [
    { key: "audio_sink", multiple: false },
    { key: "wake_light", multiple: false },
    { key: "display_surface", multiple: false },
    { key: "notify_channel", multiple: true },
    { key: "sleep_signal", multiple: true },
    { key: "presence_signal", multiple: true },
    { key: "conversation", multiple: false },
    { key: "tts", multiple: false },
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
            const profiles = {
                ...this._profiles,
                [this.userId]: { name: this.userName || this.userId, bindings },
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
            return b `<div class="intro">Caricamento dispositivi…</div>`;
        }
        return b `
      <p class="intro">
        Dispositivi di <span class="who">${this.userName || "questo profilo"}</span> —
        tutto opzionale. Cerca e aggiungi solo ciò che ti serve; l'orario esatto è
        sempre garantito.
      </p>
      ${ROLES.map((role) => this._role(role.key, role.multiple))}
      <div class="savebar">
        <button class="btn primary" ?disabled=${this._saving} @click=${this._save}>
          ${this._saving ? "Salvataggio…" : "Salva i miei dispositivi"}
        </button>
        ${this._saved ? b `<span class="ok">✓ Salvato</span>` : A}
      </div>
    `;
    }
    _role(key, multiple) {
        const options = this._entities.roles[key] ?? [];
        const value = multiple
            ? (this._bindings[key] ?? [])
            : (this._bindings[key] ?? "");
        return b `
      <div class="role">
        <div class="rolehead">
          <div class="ic">${ROLE_ICONS[key] ?? "•"}</div>
          <div>
            <div class="name">${ROLE_LABELS[key] ?? key}</div>
            <div class="desc">${ROLE_DESC[key] ?? ""}</div>
          </div>
        </div>
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
        margin: 0 0 6px;
        line-height: 1.5;
      }
      .who {
        font-weight: 700;
        color: var(--aurora-text);
      }
      .role {
        padding: 16px 0;
        border-top: 1px solid var(--aurora-divider);
      }
      .rolehead {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
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
      .rolehead .name {
        font-weight: 700;
      }
      .rolehead .desc {
        font-size: 0.82rem;
        color: var(--aurora-dim);
      }
      .savebar {
        position: sticky;
        bottom: 0;
        display: flex;
        align-items: center;
        gap: 12px;
        padding-top: 18px;
        margin-top: 8px;
        background: linear-gradient(transparent, var(--aurora-surface) 40%);
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
            });
            this._options = { ...res.options };
            this._saved = true;
        }
        finally {
            this._saving = false;
        }
    }
    render() {
        if (!this._entities) {
            return b `<div class="intro">Caricamento…</div>`;
        }
        const ringMin = Math.round(Number(this._options["ring_max_duration"] ?? 600) / 60);
        return b `
      <p class="intro">Impostazioni condivise da tutta l'installazione.</p>

      <div class="block">
        <label class="field">Durata massima suoneria (min)</label>
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

      ${this._calendars("skip_calendars", "Calendari per salto impegni")}
      ${this._calendars("holiday_calendars", "Calendari festività (auto-skip)")}

      <div class="savebar">
        <button class="btn primary" ?disabled=${this._saving} @click=${this._save}>
          ${this._saving ? "Salvataggio…" : "Salva globali"}
        </button>
        ${this._saved ? b `<span class="ok">✓ Salvato</span>` : A}
      </div>
    `;
    }
    _calendars(key, label) {
        const cals = this._entities.calendars ?? [];
        return b `
      <div class="block">
        <label class="field">${label}</label>
        <aurora-entity-picker
          .hass=${this.hass}
          .options=${cals}
          .value=${this._options[key] ?? []}
          .multiple=${true}
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
        color: #fff;
        background: var(--aurora-grad);
        border-color: transparent;
      }
      .none {
        font-size: 0.85rem;
        color: var(--aurora-dim);
        font-style: italic;
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
            return "Tutti";
        return this._names[this._selected] ?? this.hass.user?.name ?? "Profilo";
    }
    render() {
        if (!this.hass)
            return b `${A}`;
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
                <option value=${ALL} ?selected=${this._selected === ALL}>Tutti</option>
              </select>`
            : b `<span>${this._selectedName}</span>`}
          <div class="avatar">${initial}</div>
        </div>
      </div>

      <div class="tabs">
        <button class="tab ${this._tab === "alarms" ? "on" : ""}" @click=${() => (this._tab = "alarms")}>
          Sveglie
        </button>
        <button class="tab ${this._tab === "devices" ? "on" : ""}" @click=${() => (this._tab = "devices")}>
          Dispositivi
        </button>
        <button class="tab ${this._tab === "globals" ? "on" : ""}" @click=${() => (this._tab = "globals")}>
          Globali
        </button>
      </div>

      <div class="content">
        <div class="panel-card">${this._tabContent()}</div>
      </div>
      <aurora-ring-overlay .hass=${this.hass}></aurora-ring-overlay>
    `;
    }
    _tabContent() {
        if (this._tab === "globals") {
            return b `<aurora-globals-view .hass=${this.hass}></aurora-globals-view>`;
        }
        if (this._tab === "devices") {
            if (this._selected === ALL) {
                return b `<div class="hint">Seleziona un profilo per configurarne i dispositivi.</div>`;
            }
            return b `<aurora-devices-view
        .hass=${this.hass}
        .userId=${this._selected}
        .userName=${this._selectedName}
      ></aurora-devices-view>`;
        }
        // alarms
        return b `<aurora-alarm-list
      .hass=${this.hass}
      .profileId=${this._selected === ALL ? null : this._selected}
      .showAll=${this._selected === ALL}
    ></aurora-alarm-list>`;
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
        padding: 6px 10px;
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
