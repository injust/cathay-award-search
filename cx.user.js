// ==UserScript==
// @name                Cathay Award Search Fixer 2022
// @name:zh-TW          國泰獎勵機票搜尋引擎修復神器 2022
// @namespace           jayliutw
// @version             3.3.0+injust
// @description         Un-Elevate Your Cathay Award Search 2022
// @author              jayliutw
// @connect             cathaypacific.com
// @match               https://*.cathaypacific.com/cx/*/book-a-trip/redeem-flights/facade.html*
// @match               https://*.cathaypacific.com/cx/*/book-a-trip/redeem-flights/redeem-flight-awards.html*
// @match               https://book.cathaypacific.com/*
// @grant               GM.xmlHttpRequest
// @grant               GM_getValue
// @grant               GM_setValue
// @grant               unsafeWindow
// @license             GPL
// ==/UserScript==

// ============================================================
// Main Userscript
// ============================================================
(function() {
    'use strict'

    // ============================================================
    // Debugging
    // ============================================================

    const debug = false

    function log(...data) {
        if (debug) console.debug(...data)
    }

    // ============================================================
    // Greasymonkey Function Wrappers
    // ============================================================

    // Get and Set Stored Values
    function value_get(valueName, defaultValue) {
        return GM_getValue(valueName, defaultValue)
    }

    function value_set(valueName, setValue) {
        GM_setValue(valueName, setValue)
        return setValue
    }

    // XMLHttpRequest and GM.xmlHttpRequest
    function httpRequest(request, native = false) {
        if (!native && !debug) {
            GM.xmlHttpRequest(request)
        } else {
            if (!request.method || !request.url) return
            const http = new XMLHttpRequest()
            http.withCredentials = true
            http.open(request.method, request.url, true)
            if (request.headers) {
                for (const [key, value] of Object.entries(request.headers)) {
                    http.setRequestHeader(key, value)
                }
            }
            if (request.onreadystatechange) {
                http.onreadystatechange = function() {
                    request.onreadystatechange(this)
                }
            }
            if (request.onload) {
                http.onload = function() {
                    request.onload(this)
                }
            }
            if (request.data) {
                http.send(request.data)
            } else {
                http.send()
            }
        }
    }

    // ============================================================
    // Initialize Variables
    // ============================================================

    let route_changed = false

    // Retrieve CX Parameters

    let static_path = value_get('static_path', '/CathayPacificAwardV3/AML_IT3.1.14/')
    let requestVars = {}
    let tab_id = ''
    const availability_url = 'https://book.cathaypacific.com/CathayPacificAwardV3/dyn/air/booking/availability?TAB_ID='
    let form_submit_url = availability_url + tab_id

    function initCXvars() {
        if (typeof staticFilesPath !== 'undefined' && static_path != staticFilesPath) {
            log(typeof staticFilesPath)
            static_path = staticFilesPath
            value_set('static_path', static_path)
        }

        if (typeof tabId === 'string') {
            tab_id = tabId
        }
        if (typeof requestParams === 'string') {
            requestVars = JSON.parse(requestParams)
            tab_id = requestVars.TAB_ID
        } else if (typeof requestParams === 'object') {
            requestVars = requestParams
            tab_id = requestParams.TAB_ID || ''
        }

        form_submit_url = typeof formSubmitUrl !== 'undefined' ? formSubmitUrl : availability_url + tab_id
    }

    const browser_locale = navigator.language
    const browser_lang = 'en'
    const browser_country = 'CA'

    const login_url = `https://www.cathaypacific.com/content/cx/${browser_lang}_${browser_country}/sign-in.html?loginreferrer=${encodeURI(`https://www.cathaypacific.com/cx/${browser_lang}_${browser_country}/book-a-trip/redeem-flights/redeem-flight-awards.html`)}`

    const r = Math.random()
    let t = tab_id || ''

    // ============================================================
    // Helper Functions
    // ============================================================

    // Wait for Element to Load
    function waitForElm(selector) {
        return new Promise(resolve => {
            if (document.querySelector(selector)) {
                return resolve(document.querySelector(selector))
            }
            const observer = new MutationObserver(mutations => {
                if (document.querySelector(selector)) {
                    resolve(document.querySelector(selector))
                    observer.disconnect()
                }
            })
            observer.observe(document.body, {
                childList: true,
                subtree: true
            })
        })
    }

    // Check CX Date String Validity (dateString YYYYMMDD)
    function isValidDate(dateString) {
        if (!/^\d{8}$/.test(dateString)) return false
        const year = dateString.substring(0, 4)
        const month = dateString.substring(4, 6)
        const day = dateString.substring(6, 8)
        if (year < 1000 || year > 3000 || month == 0 || month > 12) return false
        const monthLength = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        if (year % 400 == 0 || (year % 100 != 0 && year % 4 == 0)) monthLength[1] = 29
        if (day <= 0 || day > monthLength[month - 1]) return false
        const today = new Date()
        const date = new Date(year, month - 1, day)
        if ((date - today) / 24 / 60 / 60 / 1000 >= 366 || (date - today) / 24 / 60 / 60 / 1000 < -1) return false
        return true
    };

    // Add to Date and Return CX Date String
    function dateAdd(days = 0, date = null) {
        let new_date = new Date()
        if (date) {
            const year = +date.substring(0, 4)
            const month = +date.substring(4, 6)
            const day = +date.substring(6, 8)
            new_date = new Date(year, month - 1, day)
        };
        new_date.setDate(new_date.getDate() + days)
        return `${new_date.getFullYear()}${(new_date.getMonth() + 1).toString().padStart(2, '0')}${new_date.getDate().toString().padStart(2, '0')}`
    };

    // Convert CX Date String to Dashed Date String
    function toDashedDate(date) {
        return `${date.substring(0, 4).toString()}-${date.substring(4, 6).toString().padStart(2, '0')}-${date.substring(6, 8).toString().padStart(2, '0')}`
    }

    // Get Weekday from CX Date String
    function dateWeekday(date) {
        const newdate = new Date(+date.substring(0, 4), (+date.substring(4, 6) - 1), +date.substring(6, 8))
        const weekday = {
            1: 'Mon',
            2: 'Tue',
            3: 'Wed',
            4: 'Thu',
            5: 'Fri',
            6: 'Sat',
            0: 'Sun'
        }
        return weekday[newdate.getDay()]
    };

    // Get Time
    function getFlightTime(timestamp, timeonly = false) {
        const date = new Date(timestamp)
        if (timeonly) {
            const hours = (date.getUTCDate() - 1) * 24 + date.getUTCHours()
            return (hours > 0 ? hours.toString() + 'hr ' : '') + date.getUTCMinutes().toString() + 'mins'
        } else {
            return `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}-${date.getUTCDate().toString().padStart(2, '0')} ${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}`
        };
    };

    // Append CSS to DOM Element (Default to Shadow Root)
    function addCss(cssString, target = shadowRoot) {
        const styleSheet = document.createElement('style')
        styleSheet.innerHTML = cssString
        target.appendChild(styleSheet)
    }

    // ============================================================
    // Get Stored Values
    // ============================================================

    // Set Search Parameters

    let uef_from = value_get('uef_from', 'HKG')
    let uef_to = value_get('uef_to', 'TYO')
    let uef_date = value_get('uef_date', dateAdd(14))
    let uef_adult = value_get('uef_adult', 1)
    let uef_child = value_get('uef_child', 0)

    // Saved Queries

    const saved = value_get('saved', {})
    const saved_flights = value_get('saved_flights', {})

    const cont_query = value_get('cont_query', false) /// cont_query/.test(window.location.hash); //urlParams.get('cont_query');
    const cont_batch = value_get('cont_batch', false) /// cont_batch/.test(window.location.hash); //urlParams.get('cont_batch');
    const cont_saved = value_get('cont_saved', false) /// cont_saved/.test(window.location.hash); //urlParams.get('cont_saved');
    const cont_ts = value_get('cont_ts', 0) // window.location.hash.match(/cont_ts=([0-9]+)&/) ? window.location.hash.match(/cont_ts=([0-9]+)&/)[1] : 0;

    function reset_cont_vars() {
        value_set('cont_query', false)
        value_set('cont_batch', false)
        value_set('cont_saved', false)
        value_set('cont_ts', 0)
    }

    // ============================================================
    // Initialize Shadow Root
    // ============================================================

    const shadowWrapper = document.createElement('div')
    shadowWrapper.style.margin = 0
    shadowWrapper.style.padding = 0
    const shadowRoot = shadowWrapper.attachShadow({
        mode: 'closed'
    })
    const shadowContainer = document.createElement('div')
    shadowContainer.classList.add('elevated_on')
    shadowRoot.appendChild(shadowContainer)

    if (debug && unsafeWindow.shadowRoot == undefined) {
        unsafeWindow.shadowRoot = shadowRoot
    }

    function initRoot() {
        log('initRoot()')

        addCss(styleCss)

        const current_url = window.location.href

        if (current_url.includes('redeem-flight-awards.html')) {
            reset_cont_vars()

            log('initRoot redeem-flight-awards.html')
            waitForElm('.redibe-v3-flightsearch form').then((elm) => {
                elm.before(shadowWrapper)
                initSearchBox()
                checkLogin()
            })
        } else if (current_url.includes('facade.html')) {
            reset_cont_vars()

            log('initRoot facade.html')
            waitForElm('.ibered__search-panel').then((elm) => {
                elm.before(shadowWrapper)
                initSearchBox()
                checkLogin()
            })
        } else if (current_url.includes('air/booking/availability')) {
            if (cont_query) {
                log('initRoot air/booking/availability with cont_query')
                waitForElm('body > header').then((elm) => {
                    const boxes = document.querySelectorAll('body > div')
                    boxes.forEach(box => {
                        box.remove()
                    })
                    document.body.append(shadowWrapper)
                    shadowContainer.classList.add('results_container')
                    initSearchBox()
                    checkLogin()
                })
            } else {
                reset_cont_vars()

                log('initRoot air/booking/availability without cont_query')
                waitForElm('#section-flights .bound-route, #section-flights-departure .bound-route').then((elm) => {
                    shadowWrapper.style.margin = '30px 20px 0px 20px'
                    shadowWrapper.style.padding = 0
                    document.querySelector('#section-flights, #section-flights-departure').before(shadowWrapper)
                    initSearchBox()
                    checkLogin()
                })
            }
        } else if (current_url.includes('air/booking/complexAvailability')) {
            reset_cont_vars()

            log('initRoot air/booking/complexAvailability')
            waitForElm('.mc-trips .bound-route').then((elm) => {
                shadowWrapper.style.margin = '30px 20px 0px 20px'
                shadowWrapper.style.padding = 0
                document.querySelector('.mc-trips').before(shadowWrapper)
                initSearchBox()
                checkLogin()
            })
        }
    }

    // ============================================================
    // Localization
    // ============================================================

    const lang = {
        ec: browser_country,
        el: browser_lang,
        search: 'Search',
        searching: "<img src='https://book.cathaypacific.com" + static_path + "common/skin/img/icons/cx/icon-loading.gif'> Searching...",
        searching_w_cancel: "<img src='https://book.cathaypacific.com" + static_path + "common/skin/img/icons/cx/icon-loading.gif'> Searching... (Click to Stop)",
        next_batch: 'Load More...',
        search_20: 'Batch Availability for 20 Days',
        search_all_cabins: 'Search Availability in All Cabins',
        flights: 'Available Flights',
        nonstop: 'Non-Stop',
        first: 'First',
        business: 'Bus',
        premium: 'Prem',
        economy: 'Econ',
        first_full: 'First Class',
        business_full: 'Business Class',
        premium_full: 'Premium Economy',
        economy_full: 'Economy Class',
        date: 'Date',
        no_flights: 'No Redemption Availability',
        expired: 'Search Next 20 (Requires Refresh)',
        searching_cont: "<img src='https://book.cathaypacific.com" + static_path + "common/skin/img/icons/cx/icon-loading.gif'> Please wait... (Page will refresh)",
        super: 'SuperCharged Award Search',
        error: 'Unknown Error... Try Again',
        bulk_batch: 'Batch Search',
        bulk_flights: 'Flights',
        login: 'Reminder: Login before searching.',
        tab_retrieve_fail: 'Failed to retrieve key. Try logging out and in again.',
        key_exhausted: 'Key request quota exhausted, attempting to get new key...',
        getting_key: 'Attempting to retrieve API key...',
        invalid_airport: 'Invalid Airport',
        invalid_airports: 'Invalid Airports',
        invalid_code: 'Invalid Destination Code',
        invalid_date: 'Invalid Date',
        saved_queries: 'Saved Flight Queries',
        maxsegments: 'Max 6 Sectors Accepted',
        multi_book: 'Book Multi-City Award',
        query: 'Search',
        delete: 'Remove',
        search_selected: 'Search All Saved',
        book_multi: 'Book Multicity Award',
        nosaves: 'You do not have any saved queries. Click on ♥ in batch results to save.',
        loading: 'Searching...',
        human: "Cathay's website needs you to prove you're a human:",
        bot_check: 'Please Complete Cathay Bot Check'
    }

    // ============================================================
    // Search Box
    // ============================================================

    const searchBox = document.createElement('div')
    searchBox.innerHTML = `
        <div class='unelevated_form'>
            <div class='unelevated_title'><a href="https://www.cathaypacific.com/cx/${lang.el}_${lang.ec}/book-a-trip/redeem-flights/redeem-flight-awards.html">Unelevated Award Search</a></div>

            <div class='login_prompt hidden'><span class='unelevated_error'><a href="${login_url}">${lang.login}</a></span></div>

            <div class='unelevated_faves unelevated_faves_hidden'>
                <div class="faves_tabs">
                    <a href="javascript:void(0);" class="tabs tab_queries">Routes</a>
                    <a href="javascript:void(0);" class="tabs tab_flights">Flights</a>
                </div>
                <a href="javascript:void(0);" class="search_selected">${lang.search_selected} &raquo;</a>
                <a href="javascript:void(0);" class="search_multicity">${lang.book_multi} &raquo;</a>
                <div class="saved_flights"></div>
                <div class="saved_queries"></div>
            </div>

            <div class="unelevated_saved"><a href="javascript:void(0);"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="heart_save" viewBox="0 0 16 16"> <path d="M4 1c2.21 0 4 1.755 4 3.92C8 2.755 9.79 1 12 1s4 1.755 4 3.92c0 3.263-3.234 4.414-7.608 9.608a.513.513 0 0 1-.784 0C3.234 9.334 0 8.183 0 4.92 0 2.755 1.79 1 4 1z"></path></svg><span>0</span></a></div>

            <div class='labels'>
                <a href="javascript:void(0);" class="switch"><svg height="16px" width="16px" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 365.352 365.352" xml:space="preserve" stroke-width="0" transform="rotate(180)"><g id="SVGRepo_bgCarrier" stroke-width="0"></g> <path d="M363.155,169.453l-14.143-14.143c-1.407-1.407-3.314-2.197-5.304-2.197 c-1.989,0-3.897,0.79-5.304,2.197l-45.125,45.125v-57.503c0-50.023-40.697-90.721-90.721-90.721H162.3c-4.143,0-7.5,3.358-7.5,7.5 v20c0,4.142,3.357,7.5,7.5,7.5h40.26c30.725,0,55.721,24.996,55.721,55.721v57.503l-45.125-45.125 c-1.407-1.407-3.314-2.197-5.304-2.197c-1.989,0-3.896,0.79-5.304,2.197l-14.143,14.143c-1.406,1.406-2.196,3.314-2.196,5.303 c0,1.989,0.79,3.897,2.196,5.303l82.071,82.071c1.465,1.464,3.385,2.197,5.304,2.197c1.919,0,3.839-0.732,5.304-2.197 l82.071-82.071c1.405-1.406,2.196-3.314,2.196-5.303C365.352,172.767,364.561,170.859,363.155,169.453z"></path> <path d="M203.052,278.14h-40.26c-30.725,0-55.721-24.996-55.721-55.721v-57.503l45.125,45.126 c1.407,1.407,3.314,2.197,5.304,2.197c1.989,0,3.896-0.79,5.304-2.197l14.143-14.143c1.406-1.406,2.196-3.314,2.196-5.303 c0-1.989-0.79-3.897-2.196-5.303l-82.071-82.071c-2.93-2.929-7.678-2.929-10.607,0L2.196,185.292C0.79,186.699,0,188.607,0,190.596 c0,1.989,0.79,3.897,2.196,5.303l14.143,14.143c1.407,1.407,3.314,2.197,5.304,2.197s3.897-0.79,5.304-2.197l45.125-45.126v57.503 c0,50.023,40.697,90.721,90.721,90.721h40.26c4.143,0,7.5-3.358,7.5-7.5v-20C210.552,281.498,207.194,278.14,203.052,278.14z"></path> </svg></a>
                <label class="labels_left"><span>From</span>
                    <input tabindex="1" type='text' id='uef_from' name='uef_from' placeholder='TPE,HKG' value='${uef_from}'><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="clear_from" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"></path> </svg></a></label>
                <label class="labels_right"><span>Adults</span>
                    <input tabindex="4" type='number' inputmode='decimal' onClick='this.select()' id='uef_adult' name='uef_adult' placeholder='Adults' value='${uef_adult}' min='0'></label>
                <label class="labels_left"><span>To</span>
                    <input tabindex="2" type='text' id='uef_to' name='uef_to' placeholder='TYO,LHR,SFO' value='${uef_to}'><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="clear_to" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"></path> </svg></label>
                <label class="labels_right"><span>Children</span>
                    <input tabindex="5" type='number' inputmode='decimal' onClick='this.select()' id='uef_child' name='uef_child' placeholder='Children' value='${uef_child}' min='0'></label>
                <label class="labels_left"><span>Date</span>
                    <input tabindex="3" class='uef_date' onClick='this.setSelectionRange(6, 8)' id='uef_date' inputmode='decimal' name='uef_date' placeholder='${dateAdd(30)}' value='${uef_date}'></label>
                <button class='uef_search'>${lang.search}</button>
            </div>
        </div>

        <div class='multi_box hidden'>
        <select id="multi_cabin">
    <option value="Y">${lang.economy_full}</option>
    <option value="W">${lang.premium_full}</option>
    <option value="C">${lang.business_full}</option>
    <option value="F">${lang.first_full}</option>
</select>
                <label class="labels_right"><span>Adults</span>
                    <input type='number' inputmode='decimal' onClick='this.select()' id='multi_adult' name='multi_adult' placeholder='Adults' value='1' min='0'></label>
                <label class="labels_right"><span>Children</span>
                    <input type='number' inputmode='decimal' onClick='this.select()' id='multi_child' name='multi_child' placeholder='Children' value='0' min='0'></label>
                                    <a href="javascript:void(0)" class='multi_search'>${lang.multi_book}</a>
        </div>

        <div class='bulk_box'>
            <div class="bulk_results bulk_results_hidden">
            <div class="filters">
<label><input type="checkbox" id="filter_nonstop">${lang.nonstop}</label>
<label><input type="checkbox" id="filter_first" checked>${lang.first}</label>
<label><input type="checkbox" id="filter_business" checked>${lang.business}</label>
<label><input type="checkbox" id="filter_premium" checked>${lang.premium}</label>
<label><input type="checkbox" id="filter_economy" checked>${lang.economy}</label>
</div>
                <table class='bulk_table show_first show_business show_premium show_economy'><thead><th class='bulk_date'>${lang.date}</th><th class='bulk_flights'>${lang.flights} <span class='info-x info-f'>${lang.first}</span><span class='info-x info-j'>${lang.business}</span><span class='info-x info-p'>${lang.premium}</span><span class='info-x info-y'>${lang.economy}</span></th></thead><tbody></tbody></table>
            </div>
            <div class="bulk_footer">
                <div class="bulk_footer_container">
                    <button class='bulk_submit'>${lang.search_20}</button>
                    <div class="bulk_error bulk_error_hidden"><span></span></div>
                </div>
            </div>
        </div>
        <div id="encbox"></div>
       `

    // ============================================================
    // Styles
    // ============================================================

    const styleCss = `
        .unelevated_form * { box-sizing:border-box; -webkit-text-size-adjust: none;}
        .unelevated_form a, .bulk_box a { color:#367778; }
        .unelevated_form input:focus { outline: none; }
        .results_container { max-width: 900px; margin: 0 auto; padding: 20px 20px; }
        @media screen and (max-width: 500px) { .results_container { padding:20px 10px; } }
        .cont_query .modal {display:none !important;}
        .unelevated_form { position:relative;transition: margin-left 0.7s ease-out;z-index: 11; font-family: "GT Walsheim","Cathay Sans EN", CathaySans_Rg, sans-serif; border: 1px solid #bcbec0; margin:10px 0; background: #f7f6f0; padding: 8px 0px 8px 8px; border-top: 5px solid #367778; box-shadow: 0px 0px 7px rgb(0 0 0 / 20%);}
        .unelevated_form.uef_collapsed { margin-left:-90%;}
        .unelevated_title {font-weight: 400; font-size: 17px; font-family: "GT Walsheim","Cathay Sans EN", CathaySans_Rg, sans-serif; color: #2d2d2d; margin: 5px; height:26px;}
        .unelevated_title a {text-decoration:none; color: #2d2d2d;}
        .unelevated_form .unelevated_saved { position:absolute; right:10px;top:6px;background: #ae4b4b; display: inline-block; border-radius: 5px; padding: 3px 10px;}
        .unelevated_form .unelevated_saved a, .unelevated_form .unelevated_saved a:hover, .unelevated_form .unelevated_saved a:active, .unelevated_form .unelevated_saved a:focus {font-size: 15px; line-height: 24px; text-decoration: none !important; color: white; display: block; height: 24px;}
        .unelevated_form .unelevated_saved svg.heart_save { width: 16px;margin-right: 6px;height: 24px;display: inline-block;}
        .unelevated_form .unelevated_saved svg.heart_save path { fill: #ff8b8b;}
        .unelevated_form .unelevated_saved a span {vertical-align: top; line-height: 24px;}

        .unelevated_form .autocomplete-items div:hover{
            background-color: #e9e9e9;
        }
        .unelevated_form .autocomplete-active {
            /* when navigating through the items using the arrow keys */
            background-color: DodgerBlue !important;
            color: #ffffff;
        }

        .feat_title {
            display:block;
            font-size:17px;
            font-weight:bold;
            margin-bottom:5px;
            color:#ae4b4b;
        }


        .feat_text {
            display:block;
            font-size:14px;
            color:#666;
        }

        .unelevated_form .unlock_btn{
            display: block;
            margin: 10px auto;
            padding: 5px;
            border-radius: 5px;
            text-align: center;
            text-decoration: none;
            width: 200px;
            background: linear-gradient(180deg, #fcd54a, #e8b524,#ffd561,#f7eb6d);
            color: rgb(130, 85, 50);
            border: 1px solid #f8c19c;
            box-shadow: -1px 1px 3px rgba(0,0,0,0.3);
            font-weight:bold;
        }

        .unelevated_faves .saved_queries{
            display:block;
        }

        .unelevated_faves .saved_flights{
            display:none;
        }

        .unelevated_faves.flights .saved_queries {
            display:none;
        }

        .unelevated_faves.flights .saved_flights {
            display:block;
        }
        .faves_tabs{
            margin-left: 10px;
        }
        .faves_tabs a.tabs {
            display: inline-block;
            border-radius: 5px 5px 0 0;
            text-decoration: none;
            font-size: 12px;
            line-height: 15px;
            margin-right: 5px;
            height: 25px;
            padding: 5px 10px;
            margin-top: 7px;
        }
        .unelevated_faves .tab_queries,
        .unelevated_faves.flights .tab_flights {
            background:#357677;
            color:white;
        }
        .unelevated_faves .tab_flights,
        .unelevated_faves.flights .tab_queries {
            background: #cec9b9;
            color:#444444;
        }

        .unelevated_faves .saved_queries,
        .unelevated_faves .saved_query {
            list-style: none;
        }
        .unelevated_faves .saved_queries {
            margin: 0 10px;
            padding:0px;
            border-top: 2px solid #367778;
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            top: 32px;
            overflow: scroll;
        }
        .saved_queries:empty:after {
            display:flex;
            content:"${lang.nosaves}";
            text-align: center;
            font-size: 14px;
            align-items: center;
            justify-content: center;
            height: 95%;
            opacity: 40%;
            line-height: 25px;
            margin: 0 25px;

        }
        .unelevated_faves .saved_query {
            position:relative;
            margin: 0;
            padding:3px 10px;
            font-size:12px;
            font-family: "Cathay Sans EN", CathaySans_Md, sans-serif;
        }
        .unelevated_faves .saved_query label {
            margin: 0;
            min-width: 150px;
            display: inline-block;
        }
        .unelevated_faves .saved_query input {
            vertical-align:-2px;
            margin-right:5px;
        }
        .unelevated_faves .saved_query:nth-child(odd){
            background: #f1efe6;
        }




        .unelevated_faves .saved_flights {
            list-style: none;
        }
        .unelevated_faves .saved_flights {
            margin: 0 10px;
            padding:0px;
            border-top: 2px solid #367778;
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            top: 32px;
            overflow: scroll;
        }
        .saved_flights:empty:after {
            display:flex;
            content:"${lang.nosaves}";
            text-align: center;
            font-size: 14px;
            align-items: center;
            justify-content: center;
            height: 95%;
            opacity: 40%;
            line-height: 25px;
            margin: 0 25px;

        }
        .unelevated_faves .saved_flights .saved_flight {
            position:relative;
            margin: 0;
            padding:3px 10px;
            font-size:10px;
            font-family: "Cathay Sans EN", CathaySans_Md, sans-serif;
        }
        .unelevated_faves .saved_flights .saved_flight label {
            margin: 0 0 5px 0;
            min-width: 150px;
            display: inline-block;
        }
        .unelevated_faves .saved_flights .saved_flight input {
            vertical-align:-2px;
            margin-right:5px;
        }
        .unelevated_faves .saved_flights .saved_flight:nth-child(odd){
            background: #f1efe6;
        }
        .unelevated_faves .saved_flights .saved_flight label > span {
            display:inline-block;
            vertical-align:top;
        }
        span.sf_date {
            display:block;
        }
        span.sf_route {
            background: #CCCCCC;
            padding: 2px 6px;
            border-radius: 5px 0 0 5px;
            display: inline-block;
        }
        span.sf_flights {
            background: #e3cfc8;
            padding: 2px 6px;
            border-radius: 0 5px 5px 0;
            display: inline-block;
        }
        span.sf_avail > span {
            display: inline-block;
            line-height: 11px;
            font-size: 10px;
            padding: 2px 4px;
            color: white;
            font-weight: normal;
            border-radius: 3px;
            margin-left: 3px;
            height: 15px;
        }
        span.sf_avail .av_j { background: #002e6c;}
        span.sf_avail .av_f { background: #832c40;}
        span.sf_avail .av_p { background: #487c93;}
        span.sf_avail .av_y { background: #016564;}

        .multi_box{
            height: 67px;
            background: #f7f6f0;
            border: 1px solid #bcbec0;
            position: relative;
            margin-top: -11px;
            margin-bottom: -67px;
            z-index: 10;
            padding: 10px;
            box-sizing: border-box;
            display: flex; flex-wrap: wrap;
        }
        .multi_box * {
            box-sizing: border-box;

        }
        .multi_box.hidden{
            display:none;
        }
        .multi_box select{
            border: 1px solid #bcbec0;
            height: 45px;
            width: calc(35% - 10px);
            margin-right:10px;
            display:inline-block;
            vertical-align:top;
            padding: 10px;
        }

        .multi_box label { margin:0; display: inline-block; position: relative; width: calc(20% - 10px); margin-right:10px; }
        .multi_box label > span { position: absolute; top: 0px; left: 5px; color: #66686a; font-family: Cathay Sans EN, CathaySans_Rg, sans-serif; line-height: 25px; font-size: 10px;}
        .multi_box input {  font-family: Cathay Sans EN, CathaySans_Rg, sans-serif; padding: 19px 5px 5px 5px; border-radius: 0px; border: 1px solid #bcbec0; display: inline-block; margin: 0px 8px 8px 0px; height: 45px; width: 100%; font-size:16px}
        .multi_box a.multi_search { background-color: #367778;
            overflow: hidden;
            text-overflow: ellipsis;
            border: none;
            color: white;
            vertical-align: top;
            margin: 0px;
            height: 45px;
            width: calc(25%);
            font-size: 11px;
            text-align: center;
            display: flex;
            flex-wrap: wrap;
            align-content: center;
            justify-content: center;
            text-decoration: none;
            padding: 0px 10px;
            line-height:15px;
        }
        a.switch:active {
            margin-top: 40px;
            margin-left: -18px;
        }
        a.switch {
            display: inline-block;
            position: absolute;
            background: white;
            z-index: 15;
            margin-top: 38px;
            border: 1px solid #bcbec0;
            text-decoration: none;
            padding: 2px 10px;
            border-radius: 15px;
            left: 32.5%;
            margin-left: -19px;
            height: 22px;
            line-height: 16px;
        }
        a.switch svg path {
            fill: #AAA;
        }
        .unelevated_form .labels { display: flex; flex-wrap: wrap;}
        .unelevated_form .labels label { margin:0; display: inline-block; position: relative; width:50%; padding: 0px 8px 0px 0px; }
        .unelevated_form .labels label.labels_left {width:65%;}
        .unelevated_form .labels label.labels_right {width:35%;}
        .unelevated_form .labels label > span { position: absolute; top: 0px; left: 5px; color: #66686a; font-family: Cathay Sans EN, CathaySans_Rg, sans-serif; line-height: 25px; font-size: 10px;}
        .unelevated_form .labels input {  font-family: Cathay Sans EN, CathaySans_Rg, sans-serif; padding: 19px 5px 5px 5px; border-radius: 0px; border: 1px solid #bcbec0; display: inline-block; margin: 0px 8px 8px 0px; height: 45px; width: 100%; font-size:16px}
        svg.clear_from, svg.clear_to {
            position: absolute;
            right: 20px;
            top: 15px;
            opacity: 30%;
        }

        .unelevated_form button.uef_search { background-color: #367778; white-space:nowrap; overflow:hidden;text-overflow:ellipsis;border: none; color: white; display: inline-block;vertical-align: top; margin: 0px; height: 45px; width: calc(35% - 8px); font-size:15px}


        .heavy_user_prompt {
            background: linear-gradient(339deg, #fdf98b, #e4c63f,#fef985,#eec946);
            box-shadow: -1px 1px 3px rgb(155 95 70 / 40%);
            border-radius: 5px;
            padding: 1px;
            margin-right:10px;
            margin-top:10px;
        }
        .heavy_user_prompt a {
            font-size: 15px; min-height:20px; padding:10px; line-height: 20px; text-decoration: underline !important; color: #802d2d; display: block;
            background: linear-gradient(180deg, #fcd54a, #e8b524,#ffd561,#f7eb6d);
            border-radius: 5px;
            padding: 10px 8px;
            text-align:center;
        }


        a.uef_toggle, a.uef_toggle:hover { background: #367778; display: block; position: absolute; right: -1px; top: -5px; padding-top:5px; width: 30px; text-align: center; text-decoration: none; color: white !important; padding-bottom: 5px; }
        a.uef_toggle:after {content:'«'} .uef_collapsed a.uef_toggle:after {content : '»'}
        .bulk_box {min-height: 60px; transition: margin-top 0.7s ease-out;background: #f7f6f0; border: 1px solid #bcbec0; box-shadow: 0px 0px 7px rgb(0 0 0 / 20%); margin-top: -11px !important; margin-bottom: 20px; z-index: 9; position: relative;}
        .bulk_box_hidden {position:relative; margin-top:-80px;}
        .bulk_results {transition: all 0.5s ease-out; min-height: 30px; margin: 10px;}
        .bulk_results_hidden { height:0; min-height:0; margin:0; overflow:hidden; transition: all 0.5s ease-out;}
        .filters {
            text-align:center;
            font-size:12px;
            margin-bottom:10px;
        }
        .filters input{
            vertical-align: -2px;
            margin-right:5px;
            margin-left:10px;
        }
        .filters label {
            display:inline-block;
        }
        .bulk_table { width:100%; border: 1px solid #c6c2c1; margin-top: 3px; font-size: 12px; border-spacing: 0; border-collapse: collapse; }
        .bulk_table th { text-align:center !important; font-weight:bold; background: #ebedec; line-height:17px; font-size: 12px; }
        .bulk_table td { background:white; }
        .bulk_table tr:nth-child(even) td { background:#f9f9f9; }
        .bulk_table th, .bulk_table td { border: 1px solid #c6c2c1; padding: 5px; }
        .bulk_table .bulk_date { width:80px; text-align:center; }
        .bulk_table .bulk_date a { text-decoration:underline !important; font-family: "Cathay Sans EN", CathaySans_Md, sans-serif; font-weight: 400; display:block;margin-bottom:5px;}
        .bulk_table td.bulk_flights { padding:5px 5px 0 5px; font-family: "Cathay Sans EN", CathaySans_Rg, sans-serif; font-weight: 400; line-height:0px; }
        .bulk_table td.bulk_flights .flight_list:empty:after {
            display: block;
            height: 24px;
            content: "${lang.no_flights}";
            margin-bottom: 5px;
            margin-top: -3px;
            margin-left: 10px;
            font-family: "Cathay Sans EN", CathaySans_Rg, sans-serif;
            font-weight: 400;
            line-height: 24px;
            color: #AAA;
           }
        .bulk_table td.bulk_flights .flight_list span.bulk_response_error { line-height: 24px;}
        .bulk_table .bulk_flights .bulk_no_flights { display:block;padding-bottom:5px; }
        .bulk_response_error { display:block;padding-bottom:5px;padding-left:5px;padding-right:5px; color:red; }
        .bulk_table .flight_title { display: block; background: #dde8e8; font-size: 12px; line-height: 15px; padding: 3px 7px; margin-bottom: 7px; margin-top: 2px; border-bottom: 3px solid #357677; position:relative; }
        .bulk_go_book { float:right; margin-right:5px; margin-left:10px; font-weight:bold;}
        a.bulk_save, a.bulk_save:hover, a.bulk_save:active { outline: none !important; float: left; margin-right:5px; text-decoration: none !important;}
        a.bulk_save svg.heart_save { width: 12px; height: 12 px;display: inline-block;}
        a.bulk_save svg.heart_save path { fill:gray;}
        a.bulk_saved svg.heart_save path { fill:#d65656; }
        a.bulk_save *, a.bulk_go_book * {  pointer-events: none; }
        .flight_wrapper {
            position:relative;
            display:inline-block;
        }
        .flight_info {
            position: absolute;
            left: 0;
            top: 37px;
            background: #e0e0e0;
            border: 1px solid #bbb;
            padding: 6px 10px;
            display: none;
            line-height: 18px;
            z-index: 15;
            border-radius: 5px;
            white-space: nowrap;
            box-shadow: 0px 0px 5px rgb(0 0 0 / 30%);
        }
        .flight_info > span {
            display:block;
        }
        .flight_info span.info_flight {
            font-weight:bold;
            font-family: CathaySans_Bd, sans-serif;
        }
        .info_dept > span, .info_arr > span {
            display: inline-block;
            width: 50px;
            color: #999;
            font-weight: bold;
            font-family: CathaySans_Md, sans-serif;
        }
        span.info_transit,
        span.info_duration {
            margin: 8px 0px;
            background: #ededed;
            border-radius: 5px;
            padding: 2px 8px;
            text-align: center;
            font-size: 11px;
            color: #888;
        }
        span.info_duration {
            margin-bottom:5px;
        }
        .flight_item.active + .flight_info {
            display:block;
        }
        .flight_item {
            transition: all 0.5s ease-in;
            background: #e0e0e0;
            line-height:15px !important;
            border-radius: 5px;
            margin-bottom: 5px;
            white-space: nowrap;
            font-size:12px;
            font-family: "GT Walsheim","Cathay Sans EN", CathaySans_Rg, sans-serif;
            font-weight:400;
            position:relative;
            display: inline-block;
            overflow:hidden;

            max-width:0px;
            padding: 6px 0px;
            margin-right: 0px;
        }
        .flight_item span.stopover { border-radius:5px;padding: 2px 4px; color: #909090 !important; display: inline-block; background: white; font-size: 10px; margin: 0px 4px !important; line-height: 11px; }
        .flight_item.direct { background: #cbe0cf; }
        .flight_item.saved { background:#f5ebd8; }
        .flight_item img { line-height: 15px; max-height: 15px; vertical-align: middle; margin-right: 2px; max-width: 20px;}
        .show_first .flight_item[data-f="1"],
        .show_business .flight_item[data-j="1"],
        .show_premium .flight_item[data-p="1"],
        .show_economy .flight_item[data-y="1"] {
        max-width:280px;
        padding: 6px 6px;
        margin-right: 6px;
        }
        .nonstop_only .flight_item[data-direct="0"] {
            max-width:0px;
            padding:6px 0px;
            margin-right: 0px;
        }
        span.bulk_j { background: #002e6c;}
        span.bulk_f { background: #832c40;}
        span.bulk_p { background: #487c93;}
        span.bulk_y { background: #016564;}
        .flight_item span.flight_num{
            line-height: 16px;
            vertical-align: middle;
            height: 16px;
            display: inline-block;
            padding: 2px 0;
        }
        .flight_item span.bulk_j,
        .flight_item span.bulk_f,
        .flight_item span.bulk_p,
        .flight_item span.bulk_y {
            color: white;
            border-radius: 5px;
            font-size:10px;
            overflow:hidden;
            transition: all 0.5s ease-in;
            display:inline-block;
            vertical-align:top;
            height: 16px;
            line-height: 16px;

            max-width:0px;
            padding: 2px 0px;
            margin-left: 0px;
        }
        .show_first span.bulk_f,
        .show_business span.bulk_j,
        .show_premium span.bulk_p,
        .show_economy span.bulk_y {
            max-width:25px;
            padding: 2px 5px;
            margin-left: 3px;
        }


        .flight_item:hover img,
        .flight_item:focus img,
        .flight_item:active img,
        .flight_item.saved img {
            opacity:0;
        }
        span.flight_save {
            display:none;
            position:absolute;
            left:5px;
            top:5px;
            opacity:0.6;
        }
        span.flight_save * {
            pointer-events: none;
        }
        span.flight_save svg {
            height:12px;
            width:12px;
            padding:5px;
        }
        .flight_item.saved span.flight_save {
            opacity:1;
            display:block;
        }
        .flight_item.saved svg.heart_save path {
            fill:#d65656;
        }
        .flight_item:hover span.flight_save,
        .flight_item:focus span.flight_save,
        .flight_item:active span.flight_save {
            display:inline-block;
        }
        .flight_item .chevron {
            vertical-align: top;
            display: inline-block;
            padding: 2px 0 2px 0px;
            height: 16px;
            opacity: 0.5;
            margin-right: -2px;
            margin-left: -2px;
        }
        .flight_item .chevron svg {
            vertical-align: top;
            transform:rotate(-90deg);
        }

        .flight_item.active .chevron svg {
            transform:rotate(0deg);
        }
        .flight_item * {  pointer-events: none; }
        .flight_item .flight_save {  pointer-events: auto; }

        .bulk_footer{ min-height: 45px; margin: 10px;}
        .bulk_footer.bulk_sticky .bulk_footer_container { position: fixed; bottom: 0; padding: 10px; background: #f7f6f0; margin: 0 auto; border-top: 1px solid #c6c2c1; box-shadow: 0px 0px 7px rgb(0 0 0 / 20%); max-width: 858px; left: 0; right: 0; }
        @media screen and (max-width: 500px) { .bulk_footer.bulk_sticky .bulk_footer_container  { max-width: 838px;} }
        button.bulk_submit {position:relative;background-color: #367778; border: none; color: white; vertical-align: middle; margin: 0px auto; height: 45px; line-height: 35px; padding: 5px 0; width: 100%; display: block; font-family: "GT Walsheim","Cathay Sans EN", CathaySans_Rg, sans-serif !important;font-size:15px}
        .bulk_submit img, button.uef_search img {line-height: 35px; height: 25px; width:auto; display: inline-block; margin-right: 10px; vertical-align: -7px;}
        .bulk_searching, .uef_search.searching  {background-color: #b9cdc9 !important;}
        .col-select-departure-flight > .row:last-of-type { padding-bottom: 140px; }
        span.info-x { border-radius: 5px; padding: 2px 5px; margin-left: 5px; color:white; font-size:10px; font-family: CathaySans_Md, Cathay Sans EN; font-weight: 400; }
        span.info-f { background: #832c40;}
        span.info-j { background: #002e6c;}
        span.info-p { background: #487c93;}
        span.info-y { background: #016564;}

        .login_prompt {  height: 40px; line-height: 20px; overflow: hidden; transition: all 0.5s ease-out; margin-bottom: 10px; }
        .login_prompt.hidden { height: 0; overflow:hidden; margin: 0; }

        .unelevated_faves {
            line-height: 20px;
            overflow: hidden;
            transition: all 0.5s ease-out;
            background: #eae6d9;
            border: 1px solid #bebebe;
            margin-right: 8px;
            box-shadow: inset 0px 0px 4px 0px rgb(0 0 0 / 10%);
            position: absolute;
            top: 0px;
            right: 0;
            left: 8px;
            z-index: 100;
            height: calc(100% - 52px);
            margin-top: 42px;
            opacity:1;
        }
        .unelevated_faves_hidden {height:0;opacity:0;}
        .unelevated_faves span.saved_title {
            height:20px;
            display: block;
            margin: 6px 15px;
            font-size: 13px;
            color: #787878;
            font-weight: bold;
            font-family: "Cathay Sans EN", CathaySans_Md, sans-serif;
        }
        a.search_selected {
            position: absolute;
            right: 15px;
            top: 6px;
            height: 20px;
            line-height: 20px !important;
            font-size: 12px !important;
            font-weight: bold !important;
            display:block;
        }
        .flights a.search_selected {
            position: absolute;
            right: 15px;
            top: 6px;
            height: 20px;
            line-height: 20px !important;
            font-size: 12px !important;
            font-weight: bold !important;
            display:none;
        }
        a.search_multicity {
            position: absolute;
            right: 15px;
            top: 6px;
            height: 20px;
            line-height: 20px !important;
            font-size: 12px !important;
            font-weight: bold !important;
            display:none;
        }
        .saved_book {
            margin-left:10px;
            line-height:20px !important;
            font-weight:bold;
            display:inline-block;
        }
        .saved_remove {
            font-weight:bold;
            position: absolute;
            line-height: 20px !important;
            font-weight: bold;
            right: 5px;
            top: 3px;
        }
        .flights .saved_remove {
            line-height: 36px !important;
        }
        .multi_on .search_multicity {
            position: absolute;
            right: 15px;
            top: 6px;
            height: 20px;
            line-height: 20px !important;
            font-size: 12px !important;
            font-weight: bold !important;
            display:block;
        }
        .multi_on .saved_book,
        .multi_on .saved_remove,
        .multi_on .search_selected {
            display:none;
        }
        .leg{ color: #ae4b4b !important; font-weight:bold;}
        .saved_remove svg{
            height:20px;
            fill:#b4afaf;
        }
        .saved_book *, .saved_remove * {
            pointer-events: none;
        }
        span.unelevated_error { padding: 10px 0 10px 10px; line-height:20px; max-height:100%; display: block; background: #ffd2d2; border-radius: 5px; margin: 0 10px 5px 0; text-align: center; color: #b54545; font-weight:bold; font-size:14px;}
        span.unelevated_error a {padding: 0; margin: 0;  text-decoration: underline; line-height: 20px; max-height: 100%; height: 24px; display: block; background: #ffd2d2; border-radius: 5px; margin: 0 10px 5px 0; text-align: center; color: #b54545;font-family: CathaySans_Md, Cathay Sans EN; font-weight: 400;}
        .bulk_error span {padding: 5px; line-height: 20px; height: 20px; max-height: 100%; display: block; background: #eae6d9; border-radius: 5px; text-align: center; color: #b54545; margin-top: 10px; font-size: 12px; transition: all 0.5s ease-out;font-family: CathaySans_Md, Cathay Sans EN; font-weight: 400;}
        .bulk_error_hidden span { height:0; margin-top: 0; overflow:hidden; padding:0;}

        .unelevated_form .autocomplete {
            /* the container must be positioned relative */
            position: relative;
            display: inline-block;
        }
        .unelevated_form .autocomplete-items {
            position: absolute;
            border: 1px solid #bcbec0;
            border-top: none;
            z-index: 99;
            top: 100%;
            left: 0;
            right: 8px;;
            margin-top:-8px;
            max-height:200px;
            overflow:scroll;
            background:white;
        }
        .unelevated_form .autocomplete-items div {
            padding: 5px;
            cursor: pointer;
            background-color: #fff;
            border-bottom: 1px solid #e4e4e4;
            font-size:12px;
            font-weight: normal;
            font-family: "Cathay Sans EN", CathaySans_Rg, sans-serif;
            white-space: nowrap;
            overflow: hidden;
        }
        .unelevated_form .autocomplete-items div span.sa_code {
            margin-left:5px;
            display:inline-block;
            width:30px;
            font-weight:normal;
        }
        .unelevated_form .autocomplete-items div span.sc_code {
            color:#888;
            display:inline-block;
            margin-left:10px;
            font-weight:normal;
        }

        .unelevated_form .autocomplete-items div:hover {
            /* when hovering an item */
            background-color: #e9e9e9;
        }
        .unelevated_form .autocomplete-active, .unelevated_form div.autocomplete-active span.sc_code {
            /* when navigating through the items using the arrow keys */
            background-color: DodgerBlue !important;
            color: #ffffff;
        }
    `

    addCss(`.captcha_wrapper {
            position: fixed;
            top: 150px;
            left: 50%;
            width: 300px;
            height: 200px;
            background: white;
            z-index: 20;
            padding: 10px;
            margin-left: -150px;
            box-shadow: 0px 0px 5px;
            border-radius: 5px;
        }
        .human_check {
            margin: 10px 20px 20px 20px;
            text-align: center;
        }
        `, document.body)

    // ============================================================
    // Form Listeners
    // ============================================================

    let btn_search, btn_batch
    let input_from, input_to, input_date, input_adult, input_child
    let clear_from, clear_to
    let link_search_saved, link_search_multi, div_filters
    let div_login_prompt, div_footer, div_ue_container, div_saved, div_faves_tabs, div_saved_queries
    let div_saved_flights, div_multi_box, div_table, div_table_body

    function assignElements() {
        log('assignElements()')
        btn_search = shadowRoot.querySelector('.uef_search') // Search Button
        btn_batch = shadowRoot.querySelector('.bulk_submit') // Batch Search Button
        input_from = shadowRoot.querySelector('#uef_from')
        input_to = shadowRoot.querySelector('#uef_to')
        input_date = shadowRoot.querySelector('#uef_date')
        input_adult = shadowRoot.querySelector('#uef_adult')
        input_child = shadowRoot.querySelector('#uef_child')
        clear_from = shadowRoot.querySelector('.clear_from')
        clear_to = shadowRoot.querySelector('.clear_to')

        link_search_saved = shadowRoot.querySelector('.search_selected')
        link_search_multi = shadowRoot.querySelector('.multi_search')

        div_filters = shadowRoot.querySelector('.filters')
        div_login_prompt = shadowRoot.querySelector('.login_prompt')
        div_footer = shadowRoot.querySelector('.bulk_footer')
        div_ue_container = shadowRoot.querySelector('.unelevated_form')
        div_saved = shadowRoot.querySelector('.unelevated_faves')
        div_faves_tabs = shadowRoot.querySelector('.unelevated_faves .faves_tabs')
        div_saved_queries = shadowRoot.querySelector('.unelevated_faves .saved_queries')
        div_saved_flights = shadowRoot.querySelector('.unelevated_faves .saved_flights')
        div_multi_box = shadowRoot.querySelector('.multi_box')
        div_table = shadowRoot.querySelector('.bulk_table')
        div_table_body = shadowRoot.querySelector('.bulk_table tbody')
    }

    function addFormListeners() {
        log('addFormListeners()')
        btn_search.addEventListener('click', function(e) {
            uef_from = value_set('uef_from', input_from.value)
            uef_to = value_set('uef_to', input_to.value)
            uef_date = value_set('uef_date', input_date.value)
            uef_adult = value_set('uef_adult', parseInt(input_adult.value))
            uef_child = value_set('uef_child', parseInt(input_child.value))
            regularSearch([{
                from: uef_from.substring(0, 3),
                to: uef_to.substring(0, 3),
                date: uef_date
            }], {
                adult: uef_adult,
                child: uef_child
            }, 'Y', (uef_to.length > 3), false)
        })

        btn_batch.addEventListener('click', function(e) {
            bulk_click()
        })

        shadowRoot.querySelector('.switch').addEventListener('click', function(e) {
            const from = input_from.value
            const to = input_to.value
            input_from.value = to
            input_to.value = from
            route_changed = true
        });

        [input_from, input_to].forEach(item => {
            item.addEventListener('keyup', function(e) {
                if (r != t) return
                if (e.keyCode == 32 || e.keyCode == 188 || e.keyCode == 13) {
                    if (e.keyCode == 13) this.value += ','
                    this.value = this.value.toUpperCase().split(/[ ,]+/).join(',')
                }
            })
        })

        input_from.addEventListener('change', function(e) {
            if (r != t) this.value = this.value.toUpperCase().substring(0, 3)
            route_changed = true
            batchLabel(`${lang.bulk_batch} ${input_from.value} - ${input_to.value} ${lang.bulk_flights}`)
            const dest = this.value.match(/[A-Z]{3}$/)
            if (dest) getDestinations(dest[0])
        })

        input_to.addEventListener('change', function(e) {
            if (r != t) this.value = this.value.toUpperCase().substring(0, 3)
            route_changed = true
            batchLabel(`${lang.bulk_batch} ${input_from.value} - ${input_to.value} ${lang.bulk_flights}`)
        })

        let inFocus = false;

        [input_from, input_to].forEach(item => {
            item.addEventListener('focus', function(e) {
                if (this.value.length > 0 && r == t) this.value = this.value + ','
            })
        });

        [input_from, input_to].forEach(item => {
            item.addEventListener('click', function(e) {
                if (r == t) {
                    if (!inFocus) this.setSelectionRange(this.value.length, this.value.length)
                    inFocus = true
                } else {
                    this.select()
                }
            })
        });

        [input_from, input_to].forEach(item => {
            item.addEventListener('blur', function(e) {
                inFocus = false
                this.value = this.value.toUpperCase().split(/[ ,]+/).join(',').replace(/,+$/, '')
                this.dispatchEvent(new Event('change'))
                checkCities(this)
            })
        })

        input_date.addEventListener('change', function(e) {
            if (!isValidDate(this.value)) {
                alert(lang.invalid_date)
                this.value = uef_date
            } else {
                route_changed = true
            }
        })

        clear_from.addEventListener('click', function(e) {
            input_from.value = ''
        })

        clear_to.addEventListener('click', function(e) {
            input_to.value = ''
        })

        div_table.addEventListener('click', function(e) {
            let key
            if (e.target.dataset.book) {
                stop_batch()
                // stop_search = true;
                // searching = false;
                e.target.innerText = lang.loading
                regularSearch([{
                    from: (e.target.dataset.from ? e.target.dataset.from : uef_from.substring(0, 3)),
                    to: (e.target.dataset.dest ? e.target.dataset.dest : uef_to.substring(0, 3)),
                    date: e.target.dataset.date
                }], {
                    adult: uef_adult,
                    child: uef_child
                })
            } else if (e.target.dataset.save) {
                key = e.target.dataset.date + e.target.dataset.from + e.target.dataset.dest
                if (e.target.classList.contains('bulk_saved')) {
                    e.target.classList.remove('bulk_saved')
                    delete saved[key]
                    update_saved_count()
                } else {
                    e.target.classList.add('bulk_saved')
                    saved[key] = 1
                    update_saved_count()
                }
                value_set('saved', saved)
            } else if (e.target.classList.contains('flight_save')) {
                key = e.target.parentNode.dataset.flightinfo
                const flightavail = e.target.parentNode.dataset.flightavail.split('_')
                if (e.target.parentNode.classList.contains('saved')) {
                    e.target.parentNode.classList.remove('saved')
                    delete saved_flights[key]
                    update_saved_flights()
                } else {
                    e.target.parentNode.classList.add('saved')
                    saved_flights[key] = {
                        f: flightavail[0],
                        j: flightavail[1],
                        p: flightavail[2],
                        y: flightavail[3]
                    }
                    update_saved_flights()
                }
                value_set('saved_flights', saved_flights)
            } else if (e.target.classList.contains('flight_item')) {
                if (e.target.classList.contains('active')) {
                    e.target.classList.remove('active')
                } else {
                    shadowRoot.querySelectorAll('.flight_item').forEach(function(elm) {
                        elm.classList.remove('active')
                    })
                    e.target.classList.add('active')
                }
            }
        })

        document.addEventListener('scroll', function() {
            shadowRoot.querySelectorAll('.flight_item').forEach(function(elm) {
                elm.classList.remove('active')
            })
        })
        // value_set('saved', {
        //     '20230809TPETYO': 1,
        //     '20230816TYOCDG': 1,
        //     '20230816TYOLHR': 1,
        //     '20230823CDGAMS': 1,
        //     '20230823CDGMAD': 1,
        //     '20230826AMSHKG': 1,
        //     '20230826MADLHR': 1,
        //     '20230906LHRHKG': 1,
        //     '20230906LHRDOH': 1,
        //     '20230913HKGTPE': 1
        // })

        div_saved.addEventListener('click', function(e) {
            if (e.target.dataset.remove) {
                delete saved[e.target.dataset.remove]
                delete saved_flights[e.target.dataset.remove]
                update_saved_count()
                update_saved_flights()
                value_set('saved', saved)
                value_set('saved_flights', saved_flights)
            }
        })

        div_saved_queries.addEventListener('click', function(e) {
            if (e.target.dataset.book) {
                stop_batch()
                e.target.innerText = lang.loading
                regularSearch([{
                    from: (e.target.dataset.from ? e.target.dataset.from : uef_from),
                    to: (e.target.dataset.dest ? e.target.dataset.dest : uef_to),
                    date: e.target.dataset.date
                }], {
                    adult: 1,
                    child: 0
                })
            } else if (e.target.type == 'checkbox') {
                div_saved_queries.querySelectorAll('.selected').forEach(function(elm) {
                    delete elm.dataset.new
                })

                if (e.target.checked) {
                    e.target.parentNode.parentNode.dataset.new = true
                    e.target.parentNode.parentNode.classList.add('selected')
                    div_saved_queries.parentNode.classList.add('multi_on')
                    div_multi_box.classList.remove('hidden')
                } else {
                    e.target.parentNode.parentNode.classList.remove('selected')
                    e.target.parentNode.parentNode.querySelector('.leg').innerText = ''
                    delete e.target.parentNode.parentNode.dataset.segment
                    if (div_saved_queries.querySelectorAll('.selected').length == 0) {
                        div_saved_queries.parentNode.classList.remove('multi_on')
                        div_multi_box.classList.add('hidden')
                    }
                }

                const segments_array = div_saved_queries.querySelectorAll('.selected')

                if (segments_array.length == 6) {
                    div_saved_queries.querySelectorAll('input:not(:checked)').forEach(item => {
                        item.disabled = true
                    })
                } else {
                    div_saved_queries.querySelectorAll('input').forEach(item => {
                        item.disabled = false
                    })
                }

                let pos = 1
                Array.from(segments_array).sort(function(a, b) {
                    if (+a.dataset.date > +b.dataset.date) return 1
                    log(a.dataset.date, b.dataset.date)
                    if (a.dataset.date == b.dataset.date) return (a.dataset.new ? 1 : (a.dataset.segment > b.dataset.segment ? 1 : -1))
                    return false
                }).forEach(function(elm) {
                    elm.dataset.segment = pos
                    elm.querySelector('.leg').innerText = 'Segment ' + pos
                    pos++
                })
            }
        })

        div_saved_flights.addEventListener('click', function(e) {})

        div_filters.querySelectorAll('input').forEach(item => {
            item.addEventListener('click', function(e) {
                if (e.target.id == 'filter_nonstop') {
                    if (e.target.checked) {
                        div_table.classList.add('nonstop_only')
                    } else {
                        div_table.classList.remove('nonstop_only')
                    }
                } else if (e.target.id == 'filter_first') {
                    if (e.target.checked) {
                        div_table.classList.add('show_first')
                    } else {
                        div_table.classList.remove('show_first')
                    }
                } else if (e.target.id == 'filter_business') {
                    if (e.target.checked) {
                        div_table.classList.add('show_business')
                    } else {
                        div_table.classList.remove('show_business')
                    }
                } else if (e.target.id == 'filter_premium') {
                    if (e.target.checked) {
                        div_table.classList.add('show_premium')
                    } else {
                        div_table.classList.remove('show_premium')
                    }
                } else if (e.target.id == 'filter_economy') {
                    if (e.target.checked) {
                        div_table.classList.add('show_economy')
                    } else {
                        div_table.classList.remove('show_economy')
                    }
                }
            })
        })

        link_search_saved.addEventListener('click', function(e) {
            if (Object.keys(saved).length == 0) {
                alert('No Saved Queries')
            } else {
                this.innerText = lang.loading
                saved_search()
            }
        })

        link_search_multi.addEventListener('click', function(e) {
            if (shadowRoot.querySelectorAll('.saved_query.selected').length == 0) {
                alert('No Selected Segments')
            } else {
                this.innerText = lang.loading
                const to_search = []
                Array.from(shadowRoot.querySelectorAll('.saved_query.selected')).sort(function(a, b) {
                    return a.dataset.segment - b.dataset.segment
                }).forEach(segment => {
                    to_search.push({
                        date: segment.dataset.date,
                        from: segment.dataset.route.substring(0, 3),
                        to: segment.dataset.route.substring(3, 6)
                    })
                })
                regularSearch(to_search, {
                    adult: shadowRoot.querySelector('#multi_adult').value,
                    child: shadowRoot.querySelector('#multi_child').value
                }, shadowRoot.querySelector('#multi_cabin').value)
            }
        })

        div_faves_tabs.addEventListener('click', function(e) {
            if (e.target.classList.contains('tab_flights')) this.parentNode.classList.add('flights')
            if (e.target.classList.contains('tab_queries')) this.parentNode.classList.remove('flights')
        })

        shadowRoot.querySelector('.unelevated_saved a').addEventListener('click', function(e) {
            // alert(JSON.stringify(saved));
            shadowRoot.querySelector('.unelevated_faves').classList.toggle('unelevated_faves_hidden')
        })
    };

    // ============================================================
    // Data Retrievers
    // ============================================================

    const airports = {
        origins: [],
        dest: []
    }

    function getOrigins() {
        log('getOrigins()')
        httpRequest({
            method: 'GET',
            url: `https://api.cathaypacific.com/redibe/airport/origin/${lang.el}/`,
            onload: function(response) {
                const data = JSON.parse(response.responseText)
                if (data.airports) {
                    data.airports.forEach(airport => {
                        airports.origins[airport.airportCode] = {
                            airportCode: airport.airportCode,
                            shortName: airport.shortName,
                            countryName: airport.countryName
                        }
                    })
                } else {
                    airports.origins = []
                }
            }
        })
    }

    function getDestinations(from) {
        if (!airports.origins[from]) return
        log('getDestinations()')
        httpRequest({
            method: 'GET',
            url: `https://api.cathaypacific.com/redibe/airport/destination/${from}/${lang.el}/`,
            onload: function(response) {
                const data = JSON.parse(response.responseText)
                if (data.airports) {
                    data.airports.forEach(airport => {
                        airports.dest[airport.airportCode] = {
                            airportCode: airport.airportCode,
                            shortName: airport.shortName,
                            countryName: airport.countryName
                        }
                    })
                } else {
                    airports.dest = []
                }
            }
        })
    }

    // ============================================================
    // UI Logic
    // ============================================================

    // Batch Button Text
    function batchLabel(label) {
        if (shadowRoot.querySelector('.bulk_submit')) {
            shadowRoot.querySelector('.bulk_submit').innerHTML = label
        }
    }

    function batchError(label = false) {
        if (label) {
            shadowRoot.querySelector('.bulk_error span').innerHTML = label
            shadowRoot.querySelector('.bulk_error').classList.remove('bulk_error_hidden')
        } else {
            shadowRoot.querySelector('.bulk_error').classList.add('bulk_error_hidden')
        }
    }

    function autocomplete(inp, list) {
        /* the autocomplete function takes two arguments: the text field element and an array of possible autocomplete values */
        let currentFocus
        /* execute a function when someone writes in the text field */
        inp.addEventListener('input', function(e) {
            newAC(this, e)
        })
        inp.addEventListener('click', function(e) {
            // newAC(this,e);
        })
        /* execute a function presses a key on the keyboard */
        inp.addEventListener('keydown', function(e) {
            let x = shadowRoot.getElementById(this.id + 'autocomplete-list')
            if (x) x = x.getElementsByTagName('div')
            if (e.keyCode == 40) {
                /* If the arrow DOWN key is pressed, increase the currentFocus variable */
                currentFocus++
                /* and and make the current item more visible */
                addActive(x)
            } else if (e.keyCode == 38) { // up
                /* If the arrow UP key is pressed, decrease the currentFocus variable */
                currentFocus--
                /* and make the current item more visible */
                addActive(x)
            } else if (e.keyCode == 13) {
                /* If the ENTER key is pressed, prevent the form from being submitted */
                e.preventDefault()
                closeAllLists()
                if (currentFocus > -1) {
                    /* and simulate a click on the "active" item */
                    if (x) x[currentFocus].click()
                } else {
                    if (x) x.querySelector(':not').click()
                }
            } else if (e.keyCode == 32 || e.keyCode == 9) {
                /* If the SPACE or TAB key is pressed, select first option */
                closeAllLists()
                /* and simulate a click on the "active" item */
                if (x) x[0].click()
            }
        })

        function addActive(x) {
            /* a function to classify an item as "active" */
            if (!x) return false
            /* start by removing the "active" class on all items */
            removeActive(x)
            if (currentFocus >= x.length) currentFocus = 0
            if (currentFocus < 0) currentFocus = x.length - 1
            /* add class "autocomplete-active" */
            x[currentFocus].classList.add('autocomplete-active')
        }

        function removeActive(x) {
            /* a function to remove the "active" class from all autocomplete items */
            for (let i = 0; i < x.length; i++) {
                x[i].classList.remove('autocomplete-active')
            }
        }

        function closeAllLists(elmnt) {
            /* close all autocomplete lists in the document, except the one passed as an argument */
            const x = shadowRoot.querySelectorAll('.autocomplete-items')
            for (let i = 0; i < x.length; i++) {
                if (elmnt != x[i] && elmnt != inp) {
                    x[i].parentNode.removeChild(x[i])
                }
            }
        }

        function checkLocale(code) {
            return code.replace('Taiwan China', 'Taiwan').replace('中國台灣', '台灣')
        }

        function newAC(elm, e) {
            const arr = airports[list] || []
            let a
            let b
            let c
            let i
            let sa
            let sc
            let se
            let val = elm.value
            /* close any already open lists of autocomplete values */
            closeAllLists()
            val = elm.value.match(/[^,]+$/) ? elm.value.match(/[^,]+$/)[0] : false
            if (!val) {
                return false
            }
            currentFocus = -1
            /* create a DIV element that will contain the items (values) */
            a = document.createElement('DIV')
            a.setAttribute('id', elm.id + 'autocomplete-list')
            a.setAttribute('class', 'autocomplete-items')
            /* append the DIV element as a child of the autocomplete container */
            elm.parentNode.appendChild(a)
            const sep = document.createElement('span')
            sep.style.display = 'none'
            sep.classList.add('ac_separator')
            a.appendChild(sep)
            /* for each item in the array... */
            const favs = ['TPE', 'TSA', 'KHH', 'RMQ', 'TYO', 'HND', 'NRT', 'KIX', 'ITM', 'CTS', 'FUK', 'NGO', 'OKA', 'ICN', 'PUS',
                'GMP', 'CJU', 'HKG', 'MFM', 'BKK', 'CNX', 'HKT', 'CGK', 'DPS', 'SUB', 'KUL', 'BKI', 'PEN', 'DAD', 'HAN', 'SGN',
                'CEB', 'MNL', 'SIN', 'PNH', 'DEL', 'BOM', 'DXB', 'DOH', 'TLV', 'BCN', 'MAD', 'MXP', 'CDG', 'ZRH', 'MUC',
                'FCO', 'FRA', 'CDG', 'AMS', 'LHR', 'LGW', 'LON', 'MAN', 'FCO', 'BOS', 'JFK', 'YYZ', 'ORD', 'IAD', 'YVR',
                'SFO', 'LAX', 'SAN', 'SEA', 'JNB', 'PER', 'SYD', 'BNE', 'MEL', 'AKL', 'HEL', 'BLR', 'SHA', 'PVG', 'PEK',
                'CAN', 'KTM', 'ADL', 'CPT', 'ATH', 'IST', 'SOF', 'VCE', 'BUD', 'PRG', 'VIE', 'BER', 'WAW', 'KBP', 'CPH',
                'DUS', 'BRU', 'OSL', 'ARN', 'DUB', 'MIA', 'ATL', 'IAH', 'DFW', 'PHL', 'CMN', 'LAS', 'SJC', 'DEN', 'AUS',
                'MSY', 'MCO', 'EWR', 'NYC', 'LIS', 'OPO', 'SPU', 'DBV', 'ZAG', 'MLE', 'LIM', 'BOG', 'CNS', 'GRU', 'SCL', 'GIG', 'EZE', 'MEX', 'CUN'
            ]
            Object.keys(arr).forEach(key => {
                /* check if the item starts with the same letters as the text field value */
                const airportCode = arr[key].airportCode
                const countryName = checkLocale(arr[key].countryName)
                const shortName = arr[key].shortName
                if (airportCode.length > 3) return
                if (val.toUpperCase() == airportCode.substr(0, val.length).toUpperCase() || val.toUpperCase() == countryName.substr(0, val.length).toUpperCase() || val.toUpperCase() == shortName.substr(0, val.length).toUpperCase()) {
                    sa = airportCode.substr(0, val.length).toUpperCase() == val.toUpperCase() ? val.length : 0
                    se = shortName.substr(0, val.length).toUpperCase() == val.toUpperCase() ? val.length : 0
                    sc = countryName.substr(0, val.length).toUpperCase() == val.toUpperCase() ? val.length : 0
                    /* create a DIV element for each matching element */
                    b = document.createElement('DIV')
                    /* make the matching letters bold */
                    c = "<span class='sa_code'><strong>" + airportCode.substr(0, sa) + '</strong>' + airportCode.substr(sa) + '</span>'
                    c += "<span class='sc_code'><strong>" + shortName.substr(0, se) + '</strong>' + shortName.substr(se) + ''
                    c += ' - <strong>' + countryName.substr(0, sc) + '</strong>' + countryName.substr(sc) + '</span>'
                    c += '</span>'
                    /* insert a input field that will hold the current array item's value */
                    c += `<input type='hidden' value='${airportCode}'>`
                    b.dataset.city = airportCode
                    b.innerHTML = c
                    /* execute a function when someone clicks on the item value (DIV element) */
                    b.addEventListener('click', function(e) {
                        /* insert the value for the autocomplete text field */
                        inp.value = [inp.value.replace(/([,]?[^,]*)$/, ''), this.dataset.city].filter(Boolean).join(',')
                        inp.dispatchEvent(new Event('change'))
                        /* close the list of autocomplete values (or any other open lists of autocomplete values) */
                        closeAllLists()
                    })

                    if (['TPE', 'KHH', 'HKG'].includes(airportCode)) {
                        a.prepend(b)
                    } else if (favs.includes(airportCode)) {
                        a.insertBefore(b, sep)
                    } else {
                        a.appendChild(b)
                    }
                }
            })
        }
        /* execute a function when someone clicks in the document */
        document.addEventListener('click', function(e) {
            if (e.target == inp) return
            closeAllLists(e.target)
        })
    }

    // ============================================================
    // Application Logic
    // ============================================================

    let searching
    let stop_search = false

    function resetSearch() {
        searching = false
        batchLabel(lang.search_20)
        shadowRoot.querySelector('.bulk_submit').classList.remove('bulk_searching')
    }

    let remaining_days = 20

    function stop_batch() {
        log('Batch Clicked. Stopping Search')
        stop_search = true
        searching = false
        shadowRoot.querySelector('.bulk_submit').innerText = lang.next_batch
        shadowRoot.querySelector('.bulk_submit').classList.remove('bulk_searching')
        batchError()
        remaining_days = 20
    }

    function bulk_click(single_date = false) {
        shadowRoot.querySelector('.bulk_results').classList.remove('bulk_results_hidden')
        if (!searching) {
            log('Batch Clicked. Starting Search')
            uef_from = value_set('uef_from', input_from.value)
            uef_to = value_set('uef_to', input_to.value)
            uef_date = value_set('uef_date', input_date.value)
            uef_adult = value_set('uef_adult', parseInt(input_adult.value))
            uef_child = value_set('uef_child', parseInt(input_child.value))
            btn_batch.innerHTML = lang.searching_w_cancel
            btn_batch.classList.add('bulk_searching')
            bulk_search(single_date)
        } else {
            stop_batch()
        }
    }

    function saved_search() {
        const to_search = []
        Object.keys(saved).forEach(query => {
            to_search.push({
                date: query.substring(0, 8),
                from: query.substring(8, 11),
                to: query.substring(11, 14)
            })
        })
        to_search.sort(function(a, b) {
            return a.date - b.date
        })

        let ss_query = to_search.shift()

        shadowRoot.querySelector('.bulk_results').classList.remove('bulk_results_hidden')
        btn_batch.innerHTML = lang.searching_w_cancel
        btn_batch.classList.add('bulk_searching')
        shadowRoot.querySelector('.bulk_table tbody').innerHTML = ''

        if (!cont_query) {
            regularSearch([{
                from: ss_query.from,
                to: ss_query.to,
                date: ss_query.date
            }], {
                adult: 1,
                child: 0
            }, 'Y', true, false, true)
            return
        }

        var populate_next_query = function(flights) {
            if (to_search.length == 0) {
                link_search_saved.innerText = lang.search_selected
                insertResults(ss_query.from, ss_query.to, ss_query.date, flights)
                stop_batch()
                stop_search = false
                searching = false
                route_changed = true
            } else {
                insertResults(ss_query.from, ss_query.to, ss_query.date, flights)
                ss_query = to_search.shift()
                searchAvailability(ss_query.from, ss_query.to, ss_query.date, 1, 0, populate_next_query)
            }
        }

        searchAvailability(ss_query.from, ss_query.to, ss_query.date, 1, 0, populate_next_query)
    }

    function update_saved_count() {
        log('update_saved_count()')
        let saved_list = ''
        const saved_arr = []
        Object.keys(saved).forEach(query => {
            const sdate = new Date(query.substring(0, 4), query.substring(4, 6) - 1, query.substring(6, 8))
            const ndate = new Date()
            if (sdate <= ndate) {
                delete saved[query]
                return
            }
            saved_arr.push({
                date: query.substring(0, 8),
                from: query.substring(8, 11).toUpperCase(),
                to: query.substring(11, 14).toUpperCase()
            })
        })
        saved_arr.sort(function(a, b) {
            return a.date - b.date
        })

        saved_arr.forEach(query => {
            const date = query.date
            const from = query.from
            const to = query.to
            saved_list += `<div class="saved_query" data-date="${date}" data-route="${from + to}"><label><input type="checkbox" data-route="${date}${from}${to}" data-date="${date}"> ${toDashedDate(date)} ${from}-${to}</label>
            <a href="javascript:void(0);" class="saved_book" data-book="true" data-date="${date}" data-from="${from}" data-dest="${to}">${lang.query} &raquo;</a>
            <span class="leg"></span>
            <a href="javascript:void(0);" class="saved_remove" data-remove="${date}${from}${to}">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="saved_delete" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"></path> </svg>
            </a></div>`
        })
        shadowRoot.querySelector('.unelevated_faves .saved_queries').innerHTML = saved_list
        shadowRoot.querySelector('.unelevated_saved a span').innerText = saved_arr.length
    }

    function update_saved_flights() {
        log('update_saved_flights()')
        let saved_list = ''
        const saved_arr = []
        Object.keys(saved_flights).forEach(query => {
            const sdate = new Date(query.substring(0, 4), query.substring(4, 6) - 1, query.substring(6, 8))
            const ndate = new Date()
            if (sdate <= ndate) {
                delete saved_flights[query]
                return
            }
            saved_arr.push({
                fullquery: query,
                date: query.substring(0, 8),
                from: query.substring(8, 11).toUpperCase(),
                to: query.substring(11, 14).toUpperCase(),
                leg1: query.split('_')[1] || '',
                stop: query.split('_')[2] || '',
                leg2: query.split('_')[3] || '',
                f: saved_flights[query].f,
                j: saved_flights[query].j,
                p: saved_flights[query].p,
                y: saved_flights[query].y
            })
        })
        saved_arr.sort(function(a, b) {
            return a.date - b.date
        })

        saved_arr.forEach(query => {
            const fullquery = query.fullquery
            const date = query.date
            const from = query.from
            const to = query.to
            const leg1 = query.leg1
            const stop = query.stop
            const leg2 = query.leg2
            const avail = {
                f: query.f,
                j: query.j,
                p: query.p,
                y: query.y
            }
            saved_list += `<div class="saved_flight" data-date="${date}" data-route="${from + to}">
            <label>
                <input type="checkbox" data-route="${date}${from}${to}" data-date="${date}">
                <span>
                    <span class="sf_date">${toDashedDate(date)}</span>
                    <span class="sf_route">${from}-${stop ? stop + '-' : ''}${to}
                    </span><span class="sf_flights">
                        ${leg1}${leg2 ? ' + ' + leg2 : ''}
                        <span class="sf_avail">
                            ${avail.f > 0 ? '<span class="av_f">F ' + avail.f + '</span>' : ''}
                            ${avail.j > 0 ? '<span class="av_j">J ' + avail.j + '</span>' : ''}
                            ${avail.p > 0 ? '<span class="av_p">PY ' + avail.p + '</span>' : ''}
                            ${avail.y > 0 ? '<span class="av_y">Y ' + avail.y + '</span>' : ''}
                        </span>
                    </span>

                </span>
            </label>
            <a href="javascript:void(0);" class="saved_book" data-book="true" "data-date="${date}" data-from="${from}" data-dest="${to}">${lang.query} &raquo;</a>
            <span class="leg"></span>
            <a href="javascript:void(0);" class="saved_remove" data-remove="${fullquery}">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="saved_delete" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"></path> </svg>
            </a></div>`
        })
        shadowRoot.querySelector('.unelevated_faves .saved_flights').innerHTML = saved_list
        shadowRoot.querySelector('.unelevated_saved a span').innerText = saved_arr.length
    }

    function checkCities(elem) {
        log('checkCities()')
        setTimeout(function() {
            let cities = elem.value.split(',')
            const errorCities = []
            cities = cities.filter(city => {
                if (city.match(/^[A-Z]{3}$/)) {
                    return true
                } else {
                    if (city) errorCities.push(city)
                    return false
                }
            })

            if (errorCities.length > 0) {
                elem.value = cities.join(',')
                elem.dispatchEvent(new Event('change'))
                alert((errorCities.length > 1 ? lang.invalid_airports : lang.invalid_airport) + ' Removed: ' + errorCities.join(','))
            }
        }, 500)
    }

    function checkLogin() {
        log('checkLogin()')
        httpRequest({
            method: 'GET',
            url: 'https://api.cathaypacific.com/redibe/login/getProfile',
            headers: {
                'Content-Type': 'application/json'
            },
            withCredentials: 'true',
            onload: function(response) {
                log('getProfile')
                const data = JSON.parse(response.responseText)
                if (data.membershipNumber) return
                div_login_prompt.classList.remove('hidden')
            }
        })
    }

    // ============================================================
    // Request Variables
    // ============================================================

    // Default Search JSON

    function newQueryPayload(route = {
        from: 'HND',
        to: 'ITM',
        date: dateAdd(14)
    }, passengers = {
        adult: 1,
        child: 0
    }, cabinclass = 'Y', oneway = false) {
        log('newQueryPayload()')
        return {
            awardType: 'Standard',
            brand: 'CX',
            cabinClass: cabinclass,
            entryCountry: lang.ec,
            entryLanguage: lang.el,
            entryPoint: `https://www.cathaypacific.com/cx/${lang.el}_${lang.ec}/book-a-trip/redeem-flights/redeem-flight-awards.html`,
            errorUrl: `https://www.cathaypacific.com/cx/${lang.el}_${lang.ec}/book-a-trip/redeem-flights/redeem-flight-awards.html?recent_search=ow`,
            returnUrl: `https://www.cathaypacific.com/cx/${lang.el}_${lang.ec}/book-a-trip/redeem-flights/redeem-flight-awards.html?recent_search=ow`,
            isFlexibleDate: false,
            numAdult: passengers.adult,
            numChild: passengers.child,
            promotionCode: '',
            segments: [{
                departureDate: route.date,
                origin: route.from,
                destination: route.to
            }]
        }
    }

    function newMultiPayload(routes, passengers, cabinclass = 'Y') {
        log('newMultiPayload()')
        const legs = []
        routes.forEach(segment => {
            legs.push({
                departureDate: segment.date,
                origin: segment.from,
                destination: segment.to
            })
        })
        return {
            awardType: 'Standard',
            brand: 'CX',
            cabinClass: cabinclass,
            entryCountry: lang.ec,
            entryLanguage: lang.el,
            entryPoint: `https://www.cathaypacific.com/cx/${lang.el}_${lang.ec}/book-a-trip/redeem-flights/redeem-flight-awards.html`,
            errorUrl: `https://www.cathaypacific.com/cx/${lang.el}_${lang.ec}/book-a-trip/redeem-flights/redeem-flight-awards.html?recent_search=mc`,
            returnUrl: `https://www.cathaypacific.com/cx/${lang.el}_${lang.ec}/book-a-trip/redeem-flights/redeem-flight-awards.html?recent_search=mc`,
            isFlexibleDate: false,
            numAdult: passengers.adult,
            numChild: passengers.child,
            promotionCode: '',
            segments: legs
        }
    }

    // ============================================================
    // Get New TAB_ID
    // ============================================================

    function response_parser(response, regex) {
        let result = response.match(regex)
        try {
            result = JSON.parse(result[1])
        } catch (e) {
            result = false
        }
        return result
    }

    function newTabID(callback) {
        log('Creating New Request Parameters...')
        httpRequest({
            method: 'POST',
            url: 'https://api.cathaypacific.com/redibe/standardAward/create',
            headers: {
                'Content-Type': 'application/json'
            },
            withCredentials: 'true',
            data: JSON.stringify(newQueryPayload()),
            onload: function(response) {
                log('Initial Request Parameters Received')
                const data = JSON.parse(response.responseText)
                const parameters = data.parameters
                const urlToPost = data.urlToPost || 'https://book.cathaypacific.com/CathayPacificAwardV3/dyn/air/booking/availability'
                const form_data = Object.entries(parameters).map(([key, value]) => `${key}=${value}`).join('&')

                log('Requesting New Tab ID...')
                httpRequest({
                    method: 'POST',
                    url: urlToPost,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    data: form_data,
                    withCredentials: 'true',
                    onreadystatechange: function(response) {
                        let errorBOM = ''
                        let errorMessage = lang.tab_retrieve_fail
                        if (response.readyState == 4 && response.status == 200) {
                            log('Tab ID Response Received. Parsing...')
                            const data = response.responseText
                            requestVars = response_parser(data, /requestParams = JSON\.parse\(JSON\.stringify\('([^']+)/)
                            log('requestVars:', requestVars)
                            if (!requestVars) {
                                errorBOM = response_parser(data, /errorBom = ([^;]+)/)
                                if (errorBOM?.modelObject?.step == 'Error') {
                                    errorMessage = errorBOM.modelObject?.messages[0]?.subText || errorMessage
                                }
                                log('Tab ID Could not be parsed')
                                batchError(`<strong>Error:</strong> ${errorMessage} (<a href='${login_url}'>Login</a>) `)
                                resetSearch()
                                return false
                            }
                            tab_id = requestVars.TAB_ID ? requestVars.TAB_ID : ''
                            log('New Tab ID:', tab_id)
                            batchError()
                            form_submit_url = availability_url + tab_id
                            if (callback) callback()
                        } else if (response.readyState == 4) {
                            errorBOM = response_parser(response.responseText, /errorBom = ([^;]+)/)
                            if (errorBOM?.modelObject?.step == 'Error') {
                                errorMessage = errorBOM.modelObject?.messages[0]?.subText || errorMessage
                            }
                            log('Failed to receive Tab ID')
                            resetSearch()
                            batchError(`<strong>Error:</strong> ${errorMessage} ( <a href='${login_url}'>Login</a> ) `)
                        }
                    }
                }, true)
            }
        })
    }

    // ============================================================
    // Regular Search
    // ============================================================

    function regularSearch(route = [{
        from: 'TPE',
        to: 'TYO',
        date: dateAdd(14)
    }], passengers = {
        adult: 1,
        child: 0
    }, cabinclass = 'Y', is_cont_query = false, is_cont_batch = false, is_cont_saved = false) {
        let cx_string
        if (route.length == 1) {
            cx_string = JSON.stringify(newQueryPayload(route[0], passengers, cabinclass, true))
        } else if (route.length > 1) {
            cx_string = JSON.stringify(newMultiPayload(route, passengers, cabinclass))
        } else {
            return
        }

        // var cx_string = JSON.stringify(newQueryPayload(uef_from, uef_to, uef_date, uef_adult, uef_child));
        log('cx_string:', cx_string)
        btn_search.innerHTML = lang.searching
        btn_search.classList.add('searching')
        httpRequest({
            method: 'POST',
            url: 'https://api.cathaypacific.com/redibe/standardAward/create',
            headers: {
                'Content-Type': 'application/json'
            },
            withCredentials: 'true',
            data: cx_string,
            onload: function(response) {
                const data = JSON.parse(response.responseText)
                const parameters = data.parameters
                const urlToPost = data.urlToPost || 'https://book.cathaypacific.com/CathayPacificAwardV3/dyn/air/booking/availability'
                log('regularSearch parameters:', parameters)
                const action_url = new URL(urlToPost)
                if (is_cont_query) value_set('cont_query', true)
                if (is_cont_batch) value_set('cont_batch', true)
                if (is_cont_saved) value_set('cont_saved', true)
                value_set('cont_ts', Date.now())
                // Create a form dynamically
                const form = document.createElement('form')
                form.setAttribute('name', 'regular_search_form')
                form.setAttribute('method', 'post')
                form.setAttribute('action', action_url)

                for (const [key, value] of Object.entries(parameters)) {
                    const input = document.createElement('input')
                    input.setAttribute('type', 'hidden')
                    input.setAttribute('name', key)
                    input.setAttribute('value', value)
                    form.appendChild(input)
                }

                document.getElementsByTagName('body')[0].appendChild(form)
                // document.forms.regular_search_form.submit();
                form.submit()
            }
        })
    }

    // ============================================================
    // Bulk Search
    // ============================================================

    let bulk_date = ''

    function bulk_search(single_date = false) {
        log('bulk_search start, remaining_days:', remaining_days)
        let no_continue = false
        if (remaining_days-- == 0) {
            stop_batch()
            no_continue = true
        }

        log('remaining_days:', remaining_days)

        uef_from = input_from.value
        uef_to = input_to.value
        uef_date = input_date.value
        uef_adult = parseInt(input_adult.value)
        uef_child = parseInt(input_child.value)

        if (!cont_query) {
            regularSearch([{
                from: uef_from.substring(0, 3),
                to: uef_to.substring(0, 3),
                date: uef_date
            }], {
                adult: uef_adult,
                child: uef_child
            }, 'Y', true, true)
            return
        }

        bulk_date ||= input_date.value

        if (route_changed) {
            div_table_body.innerHTML = ''
            bulk_date = input_date.value
            div_ue_container.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            })
            route_changed = false
        }
        const routes = []
        const rt_from = uef_from.split(',')
        const rt_to = uef_to.split(',')
        const query_count = rt_from.length * rt_to.length

        if (!no_continue & remaining_days > Math.ceil(25 / query_count)) {
            remaining_days = Math.ceil(25 / query_count) - 1
        }

        if (r == t) {
            rt_from.forEach(from => {
                rt_to.forEach(to => {
                    routes.push({
                        from,
                        to
                    })
                })
            })
        } else {
            routes.push({
                from: rt_from[0],
                to: rt_to[0]
            })
        }

        let this_route = routes.shift()

        var populate_next_route = function(flights) {
            insertResults(this_route.from, this_route.to, bulk_date, flights)

            if (routes.length <= 0) {
                bulk_date = dateAdd(1, bulk_date)
                if (single_date) stop_batch()
                bulk_search()
            } else {
                this_route = routes.shift()
                searchAvailability(this_route.from, this_route.to, bulk_date, uef_adult, uef_child, populate_next_route)
            }
        }
        searchAvailability(this_route.from, this_route.to, bulk_date, uef_adult, uef_child, populate_next_route)
    }

    // ============================================================
    // Search Availability
    // ============================================================

    function searchAvailability(from, to, date, adult, child, callback) {
        if (stop_search) {
            stop_search = false
            searching = false
            return
        }

        searching = true

        // If destination is not valid, abort
        if (!/^[A-Z]{3}$/.test(to)) {
            callback({
                modelObject: {
                    isContainingErrors: true,
                    messages: [{
                        text: lang.invalid_code
                    }]
                }
            })
            return
        }

        const requests = requestVars
        log('searchAvailability() requests:', requests)

        requests.B_DATE_1 = date + '0000'
        // requests.B_DATE_2 = dateAdd(1,date) + "0000";
        requests.B_LOCATION_1 = from
        requests.E_LOCATION_1 = to
        // requests.B_LOCATION_2 = to;
        // requests.E_LOCATION_2 = from;
        delete requests.ENCT
        delete requests.SERVICE_ID
        delete requests.DIRECT_LOGIN
        delete requests.ENC

        const params = Object.entries(requests).map(([key, value]) => `${key}=${value}`).join('&')

        httpRequest({
            method: 'POST',
            url: form_submit_url,
            withCredentials: 'true',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json, text/plain, */*'
            },
            data: params,
            onreadystatechange: function(response) {
                const search_again = function() {
                    searchAvailability(from, to, date, adult, child, callback)
                }
                if (response.readyState == 4 && response.status == 200) {
                    batchError()
                    try {
                        var data = JSON.parse(response.responseText)
                    } catch {
                        // const res = response.responseText
                        // const incapsula_script = res.match(/<script src='(\/_Incapsula_[^]+.js)'><\/script>/)
                        // if (incapsula_script) batchError('Cathay bot block triggered.')
                        batchError('Response not valid JSON')
                        return
                    }
                    const pageBom = JSON.parse(data.pageBom)
                    callback(pageBom)
                } else if (response.readyState == 4 && response.status == 404) {
                    batchError(lang.key_exhausted)
                    newTabID(search_again)
                } else if (response.readyState == 4 && response.status >= 300) {
                    batchError(lang.getting_key)
                    newTabID(search_again)
                }
            }
        }, true)
    }

    // ============================================================
    // Insert Search Results
    // ============================================================

    function insertResults(from, to, date, pageBom) {
        if (!shadowRoot.querySelector(`.bulk_table tr[data-date="${date}"]`)) {
            let results_row = ''
            results_row += `<tr data-date='${date}'><td class='bulk_date'>
        <a href='javascript:void(0)' data-book='true' data-date='${date}'>${toDashedDate(date)}</a>
        ${dateWeekday(date)}
        </td><td class='bulk_flights'></td></tr>`
            shadowRoot.querySelector('.bulk_table tbody').insertAdjacentHTML('beforeend', results_row)
        }

        const heart_svg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="heart_save" viewBox="0 0 16 16"> <path d="M4 1c2.21 0 4 1.755 4 3.92C8 2.755 9.79 1 12 1s4 1.755 4 3.92c0 3.263-3.234 4.414-7.608 9.608a.513.513 0 0 1-.784 0C3.234 9.334 0 8.183 0 4.92 0 2.755 1.79 1 4 1z"></path></svg>'

        let noflights = true
        let flightHTML = `<div data-from="${from}" data-to="${to}">
    <span class="flight_title">${from} - ${to}
    <a href="javascript:void(0)" class="bulk_save ${(saved[date + from + to] ? ' bulk_saved' : '')}" data-save="true" data-date="${date}" data-from="${from}" data-dest="${to}">${heart_svg}</a>
    <a href="javascript:void(0)" class="bulk_go_book" data-book="true" data-date="${date}" data-from="${from}" data-dest="${to}">Book &raquo;</a>
    </span><div class="flight_list">`

        if (pageBom.modelObject?.isContainingErrors) {
            flightHTML += `<span class='bulk_response_error'><strong>Error:</strong> ${pageBom.modelObject?.messages[0]?.text}</span>`
            // stop_batch();
        } else {
            const flights = pageBom.modelObject?.availabilities?.upsell?.bounds[0].flights
            flights.forEach((flight) => {
                let available = ''
                const f1 = +flight.segments[0].cabins?.F?.status || 0
                const j1 = +flight.segments[0].cabins?.B?.status || 0
                const p1 = +flight.segments[0].cabins?.N?.status || 0
                const y1 = (+flight.segments[0].cabins?.E?.status || 0) + (+flight.segments[0].cabins?.R?.status || 0)
                let d_f = false
                let d_j = false
                let d_p = false
                let d_y = false
                let n_f = 0
                let n_j = 0
                let n_p = 0
                let n_y = 0
                const leg1_airline = flight.segments[0].flightIdentifier.marketingAirline
                const leg1_flight_no = flight.segments[0].flightIdentifier.flightNumber
                const leg1_dep_time = getFlightTime(flight.segments[0].flightIdentifier.originDate)
                const leg1_arr_time = getFlightTime(flight.segments[0].destinationDate)
                const leg1_duration = getFlightTime(flight.duration, true)
                let flightkey
                if (flight.segments.length == 1) {
                    if (f1 >= 1) {
                        available += ` <span class='bulk_cabin bulk_f'>F <b>${f1}</b></span>`
                        d_f = true
                    }
                    if (j1 >= 1) {
                        available += ` <span class='bulk_cabin bulk_j'>J <b>${j1}</b></span>`
                        d_j = true
                    }
                    if (p1 >= 1) {
                        available += ` <span class='bulk_cabin bulk_p'>PY <b>${p1}</b></span>`
                        d_p = true
                    }
                    if (y1 >= 1) {
                        available += ` <span class='bulk_cabin bulk_y'>Y <b>${y1}</b></span>`
                        d_y = true
                    }
                    flightkey = `${date}${from}${to}_${leg1_airline}${leg1_flight_no}`
                    if (available != '') {
                        flightHTML += '<div class="flight_wrapper">'
                        flightHTML += `<div class='flight_item direct ${(saved_flights[flightkey] ? ' saved' : '')}' data-flightinfo='${flightkey}' data-flightavail='${f1 + '_' + j1 + '_' + p1 + '_' + y1}' data-direct='1' data-f='${(d_f ? 1 : 0)}' data-j='${(d_j ? 1 : 0)}' data-p='${(d_p ? 1 : 0)}' data-y='${(d_y ? 1 : 0)}'>
                        <img src='https://book.cathaypacific.com${static_path}common/skin/img/airlines/logo-${leg1_airline.toLowerCase()}.png'>
                        <span class="flight_num">${leg1_airline + leg1_flight_no}</span>
                        ${available}
                        <span class="chevron"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.34317 7.75732L4.92896 9.17154L12 16.2426L19.0711 9.17157L17.6569 7.75735L12 13.4142L6.34317 7.75732Z" fill="currentColor"></path></svg></span>
                        <span class="flight_save">${heart_svg}</span>
                    </div>
                    <div class="flight_info">
                        <span class="info_flight">${leg1_airline + leg1_flight_no}</span>
                        <span class="info_dept"><span>Departs:</span> ${leg1_dep_time}</span>
                        <span class="info_arr"><span>Arrives:</span> ${leg1_arr_time}</span>
                        <span class="info_duration"><span>Total Flight Duration:</span> ${leg1_duration}</span>
                    </div>
                    `
                        noflights = false
                        flightHTML += '</div>'
                    }
                    if (saved_flights[flightkey]) {
                        saved_flights[flightkey] = {
                            f: f1,
                            j: j1,
                            p: p1,
                            y: y1
                        }
                        update_saved_flights()
                    }
                } else {
                    const f2 = +flight.segments[1].cabins?.F?.status || 0
                    const j2 = +flight.segments[1].cabins?.B?.status || 0
                    const p2 = +flight.segments[1].cabins?.N?.status || 0
                    const y2 = (+flight.segments[1].cabins?.E?.status || 0) + (+flight.segments[1].cabins?.R?.status || 0)

                    if (f1 >= 1 && f2 >= 1) {
                        d_f = true
                        n_f = Math.min(f1, f2)
                        available += ` <span class='bulk_cabin bulk_f'>F <b>${n_f}</b></span>`
                    }
                    if (j1 >= 1 && j2 >= 1) {
                        d_j = true
                        n_j = Math.min(j1, j2)
                        available += ` <span class='bulk_cabin bulk_j'>J <b>${n_j}</b></span>`
                    }
                    if (p1 >= 1 && p2 >= 1) {
                        d_p = true
                        n_p = Math.min(p1, p2)
                        available += ` <span class='bulk_cabin bulk_p'>PY <b>${n_p}</b></span>`
                    }
                    if (y1 >= 1 && y2 >= 1) {
                        d_y = true
                        n_y = Math.min(y1, y2)
                        available += ` <span class='bulk_cabin bulk_y'>Y <b>${n_y}</b></span>`
                    }
                    const leg2_airline = flight.segments[1].flightIdentifier.marketingAirline
                    const leg2_flight_no = flight.segments[1].flightIdentifier.flightNumber
                    const leg2_dep_time = getFlightTime(flight.segments[1].flightIdentifier.originDate)
                    const leg2_arr_time = getFlightTime(flight.segments[1].destinationDate)
                    const transit_time = getFlightTime(flight.segments[1].flightIdentifier.originDate - flight.segments[0].destinationDate, true)
                    const stopcity = /^[A-Z]{3}:([A-Z:]{3,7}):[A-Z]{3}_/g.exec(flight.flightIdString)[1].replace(':', ' / ')
                    flightkey = `${date}${from}${to}_${leg1_airline}${leg1_flight_no}_${stopcity}_${leg2_airline}${leg2_flight_no}`
                    if (available != '') {
                        flightHTML += '<div class="flight_wrapper">'
                        flightHTML += `<div class='flight_item ${(saved_flights[flightkey] ? ' saved' : '')}' data-direct='0' data-flightinfo='${flightkey}'  data-flightavail='${n_f + '_' + n_j + '_' + n_p + '_' + n_y}' data-f='${d_f ? 1 : 0}' data-j='${d_j ? 1 : 0}' data-p='${d_p ? 1 : 0}' data-y='${d_y ? 1 : 0}'>
                        <img src='https://book.cathaypacific.com${static_path}common/skin/img/airlines/logo-${leg1_airline.toLowerCase()}.png'>
                        <span class="flight_num">${leg1_airline + leg1_flight_no}
                        <span class='stopover'>${stopcity}</span>
                        ${leg2_airline + leg2_flight_no}</span>
                        ${available}
                        <span class="chevron"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.34317 7.75732L4.92896 9.17154L12 16.2426L19.0711 9.17157L17.6569 7.75735L12 13.4142L6.34317 7.75732Z" fill="currentColor"></path></svg></span>
                        <span class="flight_save">${heart_svg}</span>
                    </div>
                    <div class="flight_info">
                        <span class="info_flight">${leg1_airline + leg1_flight_no}</span>
                        <span class="info_dept"><span>Departs:</span> ${leg1_dep_time}</span>
                        <span class="info_arr"><span>Arrives:</span> ${leg1_arr_time}</span>
                        <span class="info_transit"><span>Transit Time:</span> ${transit_time}</span>
                        <span class="info_flight">${leg2_airline + leg2_flight_no}</span>
                        <span class="info_dept"><span>Departs:</span> ${leg2_dep_time}</span>
                        <span class="info_arr"><span>Arrives:</span> ${leg2_arr_time}</span>
                        <span class="info_duration"><span>Total Flight Duration:</span> ${leg1_duration}</span>
                    </div>
                    `
                        noflights = false
                        flightHTML += '</div>'
                    }
                    if (saved_flights[flightkey]) {
                        saved_flights[flightkey] = {
                            f: n_f,
                            j: n_j,
                            p: n_p,
                            y: n_y
                        }
                        update_saved_flights()
                    }
                }
            })
        }
        flightHTML += '</div></div>'

        shadowRoot.querySelector(`.bulk_table tr[data-date="${date}"] .bulk_flights`).insertAdjacentHTML('beforeend', flightHTML)
        stickyFooter()
    }

    // ============================================================
    // Sticky Footer
    // ============================================================

    function stickyFooter() {
        const footerOffset = div_footer.getBoundingClientRect()
        const ueformOffset = div_ue_container.getBoundingClientRect()
        if (footerOffset.top < window.innerHeight - 55 || ueformOffset.top + div_ue_container.clientHeight > window.innerHeight - 72) {
            div_footer.classList.remove('bulk_sticky')
        } else {
            div_footer.classList.add('bulk_sticky')
        }
    }

    // ============================================================
    // Enable Advanced Features
    // ============================================================

    t = r

    // ============================================================
    // Initialize
    // ============================================================

    function initSearchBox() {
        initCXvars()
        shadowContainer.appendChild(searchBox)
        assignElements()
        addFormListeners()
        window.onscroll = function() {
            stickyFooter()
        }
        update_saved_count()
        update_saved_flights()
        autocomplete(input_from, 'origins')
        autocomplete(input_to, 'origins')
        getOrigins()

        if (cont_query) {
            reset_cont_vars()
            // If over 5 minutes since cont query, don't auto search
            if (Date.now() - cont_ts > 60 * 5 * 1000 && !debug) return
            btn_batch.innerHTML = lang.searching_w_cancel
            btn_batch.classList.add('bulk_searching')
            document.body.classList.add('cont_query')
            if (cont_saved) {
                setTimeout(() => {
                    saved_search()
                }, '1000')
            } else {
                setTimeout(() => {
                    bulk_click(!cont_batch)
                }, '1000')
            }
        }
    };

    initRoot()
})()
