import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { validateGoogleServices } from '../scripts/validate-google-services.mjs';
const read = p => readFile(new URL('../'+p,import.meta.url),'utf8');
const good = () => ({project_info:{project_id:'test-firebase',project_number:'123456789'},client:[{client_info:{mobilesdk_app_id:'1:123456789:android:abcdef',android_client_info:{package_name:'com.getyere.app'}},api_key:[{current_key:'test-client-api-key'}]}]});

test('Firebase client validation covers the fields that actually initialise FCM',()=>{
 assert.deepEqual(validateGoogleServices(JSON.stringify(good())),[]);
 for(const field of ['project_number','project_id']){const c=good();delete c.project_info[field];assert.ok(validateGoogleServices(JSON.stringify(c)).length,field);}
 for(const field of ['mobilesdk_app_id','android_client_info']){const c=good();delete c.client[0].client_info[field];assert.ok(validateGoogleServices(JSON.stringify(c)).length,field);}
 const mismatch=good();mismatch.client[0].client_info.mobilesdk_app_id='1:999:android:abcdef';assert.ok(validateGoogleServices(JSON.stringify(mismatch)).some(e=>/do not match/.test(e)));
 for(const keys of [undefined,[],[{current_key:''}]]){const c=good();c.client[0].api_key=keys;assert.ok(validateGoogleServices(JSON.stringify(c)).some(e=>/api_key/.test(e)));}
});

test('release Gradle gate cannot swallow Firebase configuration failures',async()=>{
 const gradle=await read('android/app/build.gradle');
 assert.match(gradle,/verifyReleasePushConfiguration/);assert.match(gradle,/task\.dependsOn\(verifyReleasePushConfiguration\)/);
 assert.match(gradle,/preReleaseBuild/);assert.match(gradle,/pre\.\+ReleaseBuild/);
 for(const field of ['project_number','mobilesdk_app_id','current_key','applicationId','service_account'])assert.ok(gradle.includes(field),field);
 assert.match(gradle,/throw new GradleException/);assert.doesNotMatch(gradle,/catch\(Exception e\)\s*\{\s*logger\.info/);
});

test('native guard is registered after generated plugins and keeps the official JS ID and permissions',async()=>{
 const activity=await read('android/app/src/main/java/com/getyere/app/MainActivity.java');
 const guard=await read('android/app/src/main/java/com/getyere/app/YerePushNotificationsPlugin.java');
 assert.match(activity,/protected void load\(\)/);assert.ok(activity.indexOf('registerPlugin(YerePushNotificationsPlugin.class)')<activity.indexOf('super.load()'));
 assert.match(guard,/extends PushNotificationsPlugin/);assert.match(guard,/name = "PushNotifications"/);assert.match(guard,/POST_NOTIFICATIONS/);assert.match(guard,/alias = "receive"/);
 assert.match(guard,/FirebaseApp\.getInstance\(\)\.getOptions\(\)/);assert.match(guard,/catch \(RuntimeException error\)/);assert.match(guard,/YERE_PUSH_CONFIGURATION/);
 assert.match(guard,/GoogleApiAvailabilityLight/);assert.match(guard,/YERE_PUSH_PLAY_SERVICES/);
 const unregister=guard.slice(guard.indexOf('public void unregister'));
 assert.match(unregister,/catch \(IllegalStateException noFirebaseApp\)/);assert.match(unregister,/call\.resolve\(\)/);assert.match(unregister,/deleteToken\(\)\.addOnCompleteListener/);
});

test('CI cannot build/upload a debug APK merely because this fix is pushed',async()=>{
 const workflow=await read('.github/workflows/build-android.yml');
 assert.match(workflow,/workflow_dispatch:/);assert.doesNotMatch(workflow,/^  (push|pull_request):/m);
});

async function registrationHarness({cacheRejects=false,cacheHangs=false}={}){
 const src=await read('src/native.js');
 const body=src.slice(src.indexOf("      handles.push(await PushNotifications.addListener('registration',"),src.indexOf("      handles.push(await PushNotifications.addListener('registrationError',"));
 let callback;const order=[],tokens=[];
 const context={handles:[],PUSH_TOKEN_KEY:'test-key',PushNotifications:{addListener:async(_,cb)=>{callback=cb;}},Preferences:{set:()=>{order.push('cache');return cacheHangs?new Promise(()=>{}):cacheRejects?Promise.reject(new Error('test disk failure')):Promise.resolve();}},pushToken:'',nativeBridge:{getPushRegistration:()=>({token:context.pushToken,platform:'ios',provider:'apns'})},resolvePushWaiters:(value,error)=>{order.push(error?'reject':'resolve');tokens.push({value,error});},emit:()=>order.push('emit'),Error};
 await vm.runInNewContext(`(async()=>{${body}})()`,context);
 return {callback,order,tokens,context};
}

test('real registration listener resolves before cache I/O, even when preferences fail',async()=>{
 const h=await registrationHarness({cacheRejects:true});await h.callback({value:'test-apns-token'});
 assert.deepEqual(h.order,['resolve','emit','cache']);assert.equal(h.tokens[0].value.token,'test-apns-token');
});
test('a hung preference store cannot hold the native registration handshake open',async()=>{
 const h=await registrationHarness({cacheHangs:true});const pending=h.callback({value:'test-fcm-token'});pending.catch(()=>undefined);
 assert.equal(h.tokens[0].value.token,'test-fcm-token');assert.equal(h.order[0],'resolve');
});
test('empty native tokens reject registration rather than pretending notifications are enabled',async()=>{
 const h=await registrationHarness();await h.callback({value:''});assert.equal(h.order[0],'reject');assert.equal(h.tokens[0].value,null);assert.match(h.tokens[0].error.message,/empty device token/);assert.equal(h.order.includes('cache'),false);
});

test('both iOS build configurations declare the appropriate APNs entitlement',async()=>{
 const project=await read('ios/App/App.xcodeproj/project.pbxproj');
 const debug=project.slice(project.indexOf('504EC3171FED79650016851F /* Debug */ ='),project.indexOf('504EC3181FED79650016851F /* Release */ ='));
 const release=project.slice(project.indexOf('504EC3181FED79650016851F /* Release */ ='),project.indexOf('/* End XCBuildConfiguration section */'));
 assert.match(debug,/APS_ENVIRONMENT = development/);assert.match(release,/APS_ENVIRONMENT = production/);
 for(const config of [debug,release]){assert.match(config,/CODE_SIGN_ENTITLEMENTS = App\/App.entitlements/);assert.match(config,/PRODUCT_BUNDLE_IDENTIFIER = com\.getyere\.app/);}
});

async function fullNativeHarness(options={}) {
 const source=(await read('src/native.js')).replace(/^import .*;\n/gm,'').replace('export { nativeBridge };','globalThis.bridge = nativeBridge;');
 const listeners=new Map(), calls={adds:0,removes:0,registers:0},timers=new Set();
 let failed=false;
 const context={console,Capacitor:{isNativePlatform:()=>true,getPlatform:()=>options.platform||'android'},navigator:{onLine:true,language:'en'},document:{documentElement:{classList:{add(){}}}},createSpeechController:()=>({}),SpeechRecognition:{},normalizeNotification:n=>n,CustomEvent:class{constructor(name,init){this.type=name;this.detail=init.detail;}},Preferences:{set:()=>options.cacheHangs?new Promise(()=>{}):Promise.reject(new Error('test disk failure'))},clearTimeout:(timer)=>{clearTimeout(timer);timers.delete(timer);},window:{dispatchEvent(){},setTimeout:(fn,ms)=>{const timer=setTimeout(fn,ms);timers.add(timer);return timer;}},PushNotifications:{
  addListener:async(name,callback)=>{calls.adds++;if(options.failSetupOnce&&name==='registrationError'&&!failed){failed=true;throw new Error('test listener setup failure');}listeners.set(name,callback);return {remove:async()=>{listeners.delete(name);calls.removes++;}};},
  checkPermissions:async()=>({receive:options.denied?'denied':'granted'}),createChannel:async()=>{},

 }};
 // registrationError is synchronous; normalise its result before attaching a catch.
 context.PushNotifications.register=async()=>{
  calls.registers++;
  if(options.nativeError)throw Object.assign(new Error('Notifications unavailable in this build'),{code:'YERE_PUSH_CONFIGURATION'});
  const result=options.providerError?listeners.get('registrationError')({error:'test provider failure'}):listeners.get('registration')({value:options.emptyToken?'':'test-device-token'});
  Promise.resolve(result).catch(()=>undefined);
 };
 vm.runInNewContext(source,context);
 return {bridge:context.bridge,calls,listeners,timers};
}

test('real native bridge can register before full startup; concurrent requests share four listeners',async()=>{
 const h=await fullNativeHarness({cacheHangs:true});
 const results=await Promise.all([h.bridge.registerPush(),h.bridge.registerPush()]);
 assert.equal(h.calls.adds,4);assert.equal(h.listeners.size,4);assert.equal(h.timers.size,0);
 for(const result of results){assert.equal(result.granted,true);assert.equal(result.token,'test-device-token');assert.equal(result.provider,'fcm');}
});
test('partial listener setup removes installed callbacks and retries without duplicates',async()=>{
 const h=await fullNativeHarness({failSetupOnce:true,platform:'ios'});
 await assert.rejects(h.bridge.registerPush(),/listener setup failure/);assert.equal(h.calls.removes,1);assert.equal(h.listeners.size,0);
 const result=await h.bridge.registerPush();assert.equal(result.provider,'apns');assert.equal(result.granted,true);assert.equal(h.listeners.size,4);assert.equal(h.timers.size,0);
});
test('native rejection and provider registration error both reject the JS handshake without lingering timers',async()=>{
 for(const option of ['nativeError','providerError','emptyToken']){
  const h=await fullNativeHarness({[option]:true});await assert.rejects(h.bridge.registerPush());assert.equal(h.timers.size,0,option);
 }
});
test('denied permission does not request an FCM token or report enabled notifications',async()=>{
 const h=await fullNativeHarness({denied:true});assert.equal((await h.bridge.registerPush()).granted,false);assert.equal(h.calls.registers,0);assert.equal(h.timers.size,0);
});


test('Android CI shell blocks parse, and Firebase setup cannot continue without client config',async()=>{
 const workflow=await read('.github/workflows/build-android.yml');
 const blocks=[...workflow.matchAll(/        run: \|\n((?:          .*\n|\n)+)/g)];
 assert.ok(blocks.length>0);
 for(const block of blocks){
  const script=block[1].replace(/^          /gm,'').replace(/\$\{\{[^]*?\}\}/g,'expression-placeholder');
  const result=spawnSync('bash',['-n'],{input:script,encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 }
 const firebase=workflow.slice(workflow.indexOf('- name: Install required Firebase'),workflow.indexOf('- name: Build native web bundle'));
 assert.match(firebase,/exit 1/);assert.doesNotMatch(firebase,/exit 0|REQUIRE_ANDROID_PUSH|::warning/);
});
