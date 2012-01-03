/*
 * Cookies.js handles cookie modification (setting securecookie flags)
 */

var cookieManager = hfCC["@mozilla.org/cookiemanager;1"]
.getService(hfCI.nsICookieManager2);
        

var cookieService = hfCC["@mozilla.org/cookieService;1"]
.getService(hfCI.nsICookieService);
    
    
var OS = hfCC["@mozilla.org/observer-service;1"]
.getService(hfCI.nsIObserverService);

var originallyInsecureCookies = [];

//var aConsoleService = hfCC["@mozilla.org/consoleservice;1"].
//getService(hfCI.nsIConsoleService);

function goodSSLFound(host){
    if(httpsfinder.prefs.getBoolPref("attemptSecureCookies")){   
        var enumerator = this.getCookiesFromHost(host);
        while (enumerator.hasMoreElements()) {
            var cookie = enumerator.getNext().QueryInterface(Components.interfaces.nsICookie2);
            if(!cookie.isSecure){
                this.handleInsecureCookie(cookie);                
            //this.aConsoleService.logStringMessage("Securing cookie for host: " + cookie.rawHost + "  Name: " + cookie.name);
            }
        }
    }
}

function getCookiesFromHost(host){
    return this.cookieManager.getCookiesFromHost(host);
}

function _secureIndividualCookie(cookie) {    
    if(httpsfinder.Overlay.isWhitelisted(cookie.host))
        return;
    
    this.originallyInsecureCookies.push(cookie.name + ";" + cookie.host + "/" + cookie.path);
    var expiry = Math.min(cookie.expiry, Math.pow(2,31))
    this.cookieManager.remove(cookie.host, cookie.name, cookie.path, false);
    this.cookieManager.add(cookie.host, cookie.path, cookie.name, cookie.value, true, cookie.isHTTPOnly, cookie.isSession, expiry);    
}

//Used for restoring insecure cookies (if user adds domain to whitelist, we restore defaults)
function _insecureIndividualCookie(cookie) { 
    var expiry = Math.min(cookie.expiry, Math.pow(2,31))
    this.cookieManager.remove(cookie.host, cookie.name, cookie.path, false);
    this.cookieManager.add(cookie.host, cookie.path, cookie.name, cookie.value, false, cookie.isHTTPOnly, cookie.isSession, expiry);    
}

function handleInsecureCookie(cookie){
    if(httpsfinder.results.goodSSL.indexOf(cookie.host) != -1)
        this._secureIndividualCookie(cookie);    
    else if(httpsfinder.prefs.getBoolPref("secureWildcardCookies")){
        for(var i = 0; i < httpsfinder.results.goodSSL.length; i++){
            var trimmed = httpsfinder.results.goodSSL[i];
            trimmed = trimmed.substring(trimmed.indexOf("."), trimmed.length);    
            
            if(cookie.host === trimmed)
                this._secureIndividualCookie(cookie);
        }        
    }
}

function restoreDefaultCookiesForHost(host){
    var enumerator = this.getCookiesFromHost(host);
    while (enumerator.hasMoreElements()) {
        var cookie = enumerator.getNext().QueryInterface(Components.interfaces.nsICookie2);
        
        if(this.originallyInsecureCookies.indexOf(cookie.name + ";" + cookie.host + "/" + cookie.path) != -1
            && cookie.isSecure)
            {
            this._insecureIndividualCookie(cookie);
        //aConsoleService.logStringMessage("Restoring cookie for host: " + cookie.rawHost + "  Name: " + cookie.name);
        }
    }
}

function observe(subject, topic, data) {    
    if(httpsfinder.prefs.getBoolPref("attemptSecureCookies")){
        if (data == "added" || data == "changed") {
            try {
                subject.QueryInterface(CI.nsIArray);
                var elems = subject.enumerate();
                while (elems.hasMoreElements()) {
                    var cookie = elems.getNext()
                    .QueryInterface(CI.nsICookie2);
                    if (!cookie.isSecure) 
                        this.handleInsecureCookie(cookie);                
                }
            } catch(e) {
                subject.QueryInterface(CI.nsICookie2);
                if(!subject.isSecure) 
                    this.handleInsecureCookie(subject);            
            }
        }
    }
}

function register() {
    OS.addObserver(this, "cookie-changed", false);
}

function unregister () {    
    try{
        OS.removeObserver(this, "cookie-changed");
    }
    catch(e){/* already removed if enabled pref is false*/ }
}