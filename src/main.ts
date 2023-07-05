import { GM } from 'vite-plugin-monkey/dist/client'

await (async () => {
  'use strict'

  // ============================================================
  // Logging
  // ============================================================

  const log = console.debug

  // ============================================================
  // Greasymonkey Function Wrappers
  // ============================================================

  // Get and Set Stored Values
  const valueGet: <T extends json>(key: string, defaultValue?: T) => Promise<T> = GM.getValue

  const valueSet = async <T extends json>(key: string, value: T): Promise<T> => {
    await GM.setValue(key, value)
    return value
  }

  // ============================================================
  // XMLHttpRequest
  // ============================================================

  const httpRequest = async (url: string | URL, request?: {
    headers?: HeadersInit
    data?: BodyInit
    method?: string
    withCredentials?: boolean
  }): Promise<Response> => {
    return await fetch(url, {
      headers: request?.headers,
      body: request?.data,
      method: request?.method ?? 'GET',
      credentials: request?.withCredentials ? 'include' : 'omit'
    })
  }

  // ============================================================
  // Initialize Variables
  // ============================================================

  // TODO: Auto-detect from CX URL
  const browserLang = 'en'
  const browserCountry = 'CA'

  let routeChanged = false

  // Retrieve CX Parameters

  const availabilityUrl = 'https://book.cathaypacific.com/CathayPacificAwardV3/dyn/air/booking/availability'
  // TODO: Use the membership number URL
  const loginUrl = `https://www.cathaypacific.com/content/cx/${browserLang}_${browserCountry}/sign-in.html?loginreferrer=${encodeURI(`https://www.cathaypacific.com/cx/${browserLang}_${browserCountry}/book-a-trip/redeem-flights/redeem-flight-awards.html`)}`

  let staticFilesPath = await valueGet<string>('static_files_path', '/CathayPacificAwardV3/AML_IT3.3.22/')
  let requestParams: RequestParams
  let tabId: string
  let formSubmitUrl: string

  const initCxVars = async (): Promise<void> => {
    log('initCxVars()')

    if (typeof unsafeWindow.staticFilesPath !== 'undefined') {
      // log('typeof unsafeWindow.staticFilesPath:', typeof unsafeWindow.staticFilesPath)
      if (staticFilesPath !== unsafeWindow.staticFilesPath) staticFilesPath = await valueSet('static_files_path', unsafeWindow.staticFilesPath)
    }

    if (typeof unsafeWindow.requestParams === 'string') {
      requestParams = JSON.parse(unsafeWindow.requestParams)
    } else if (typeof unsafeWindow.requestParams === 'object') {
      requestParams = unsafeWindow.requestParams
    } else {
      requestParams = {}
    }

    tabId = requestParams.TAB_ID ?? ''

    formSubmitUrl = unsafeWindow.formSubmitUrl ?? `${availabilityUrl}?TAB_ID=${tabId}`
  }

  // ============================================================
  // Helper Functions
  // ============================================================

  // Wait for Element to Load
  const waitForEl = async <E extends Element>(selectors: string): Promise<E | null> => await new Promise((resolve) => {
    if (document.querySelector<E>(selectors) != null) {
      resolve(document.querySelector<E>(selectors))
      return
    }

    const observer = new MutationObserver((mutations) => {
      if (document.querySelector<E>(selectors) != null) {
        resolve(document.querySelector<E>(selectors))
        observer.disconnect()
      }
    })
    observer.observe(document.body, {
      childList: true,
      subtree: true
    })
  })

  // Check CX Date String Validity (dateString YYYYMMDD)
  const isValidDate = (dateString: string): boolean => {
    if (!/^\d{8}$/.test(dateString)) return false
    const year = +dateString.substring(0, 4)
    const month = +dateString.substring(4, 6)
    const day = +dateString.substring(6, 8)
    if (year < 1000 || year > 3000 || month === 0 || month > 12) return false
    const monthLength = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    if (year % 400 === 0 || (year % 100 !== 0 && year % 4 === 0)) monthLength[1] = 29
    if (day <= 0 || day > monthLength[month - 1]) return false
    const today = new Date()
    const date = new Date(year, month - 1, day)
    if ((date.getTime() - today.getTime()) / 24 / 60 / 60 / 1000 >= 366 || (date.getTime() - today.getTime()) / 24 / 60 / 60 / 1000 < -1) return false
    return true
  }

  // Add to Date and Return CX Date String
  const dateAdd = (days = 0, date?: string): string => {
    let newDate = new Date()
    if (date != null) {
      const year = +date.substring(0, 4)
      const month = +date.substring(4, 6)
      const day = +date.substring(6, 8)
      newDate = new Date(year, month - 1, day)
    }
    newDate.setDate(newDate.getDate() + days)
    return `${newDate.getFullYear()}${(newDate.getMonth() + 1).toString().padStart(2, '0')}${newDate.getDate().toString().padStart(2, '0')}`
  }

  // Convert CX Date String to Dashed Date String
  const dateStringToDashedDateString = (dateString: string): string => `${dateString.substring(0, 4).toString()}-${dateString.substring(4, 6).toString().padStart(2, '0')}-${dateString.substring(6, 8).toString().padStart(2, '0')}`

  // Get Weekday from CX Date String
  const dateStringToWeekday = (dateString: string): string => {
    const date = new Date(+dateString.substring(0, 4), (+dateString.substring(4, 6) - 1), +dateString.substring(6, 8))
    const weekday = {
      0: 'Sun',
      1: 'Mon',
      2: 'Tue',
      3: 'Wed',
      4: 'Thu',
      5: 'Fri',
      6: 'Sat'
    }
    return weekday[date.getDay()]
  }

  // Get Time
  const getFlightTime = (timestamp, timeonly = false): string => {
    const date = new Date(timestamp)
    if (timeonly) {
      const hours = (date.getUTCDate() - 1) * 24 + date.getUTCHours()
      return `${(hours ? `${hours.toString()}hr ` : '') + date.getUTCMinutes().toString()}mins`
    }
    return `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}-${date.getUTCDate().toString().padStart(2, '0')} ${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}`
  }

  // Append CSS to DOM Element (Default to Shadow Root)
  const addCss = (css: string, target: Node = shadowRoot): void => {
    const styleSheet = document.createElement('style')
    styleSheet.innerHTML = css
    target.appendChild(styleSheet)
  }

  // ============================================================
  // Get Stored Values
  // ============================================================

  // Search Parameters
  const uef: { from: string, to: string, date: string, adults: number, children: number } = {
    from: 'HKG',
    to: 'TYO',
    date: dateAdd(),
    adults: 1,
    children: 0,
    ...await valueGet('uef', {})
  }

  // Saved Queries
  const savedFlights = await valueGet<SavedFlights>('saved_flights', {})
  const savedQueries = new Set(await valueGet<string[]>('saved_queries', []))

  // Search Result Filters
  const filters = {
    nonstop: false,
    first: true,
    business: true,
    premium: true,
    economy: true,
    ...await valueGet('filters', {})
  }

  const defaultContVars = { batch: false, query: false, saved: false, ts: 0 }
  const cont = { ...defaultContVars, ...await valueGet('cont', {}) }
  // const urlParams = new URLSearchParams(window.location.search)
  // const cont = {
  //   batch: urlParams.has('cont_batch'),
  //   query: urlParams.has('cont_query'),
  //   saved: urlParams.has('cont_saved'),
  //   ts: urlParams.has('cont_ts') ? parseInt(urlParams.get('cont_ts')) : 0
  // }

  const resetContVars = async (): Promise<void> => {
    await valueSet('cont', defaultContVars)
  }

  // ============================================================
  // Initialize Shadow Root
  // ============================================================

  const shadowWrapper = document.createElement('div')
  shadowWrapper.style.margin = '0'
  shadowWrapper.style.padding = '0'
  const shadowRoot = shadowWrapper.attachShadow({ mode: 'closed' })
  const shadowContainer = document.createElement('div')
  shadowRoot.appendChild(shadowContainer)

  const initRoot = async (): Promise<void> => {
    log('initRoot()')

    if (window.location.href.includes('redeem-flight-awards.html')) {
      log('initRoot redeem-flight-awards.html')

      await resetContVars()
      const el = await waitForEl<HTMLFormElement>('.redibe-v3-flightsearch form')
      el.before(shadowWrapper)
      await initSearchBox()
      await checkLogin()
    } else if (window.location.href.includes('facade.html')) {
      log('initRoot facade.html')

      await resetContVars()
      const el = await waitForEl('.ibered__search-panel')
      el.before(shadowWrapper)
      await initSearchBox()
      await checkLogin()
    } else if (window.location.href.includes('air/booking/availability')) {
      if (cont.query) {
        log('initRoot air/booking/availability with cont.query')

        await waitForEl<HTMLElement>('body > header')
        const boxes = document.querySelectorAll<HTMLDivElement>('body > div')
        boxes.forEach((box) => {
          box.remove()
        })
        document.body.append(shadowWrapper)
        shadowContainer.classList.add('results_container')
        await initSearchBox()
        await checkLogin()
      } else {
        log('initRoot air/booking/availability without cont.query')

        await resetContVars()
        await waitForEl<HTMLDivElement>('#section-flights .bound-route, #section-flights-departure .bound-route')
        shadowWrapper.style.margin = '30px 20px 0px 20px'
        shadowWrapper.style.padding = '0'
        document.querySelector('#section-flights, #section-flights-departure').before(shadowWrapper)
        await initSearchBox()
        await checkLogin()
      }
    } else if (window.location.href.includes('air/booking/complexAvailability')) {
      log('initRoot air/booking/complexAvailability')

      await resetContVars()
      await waitForEl('.mc-trips .bound-route')
      shadowWrapper.style.margin = '30px 20px 0px 20px'
      shadowWrapper.style.padding = '0'
      document.querySelector('.mc-trips').before(shadowWrapper)
      await initSearchBox()
      await checkLogin()
    }
  }

  // ============================================================
  // Localization
  // ============================================================

  const lang = {
    ec: browserCountry,
    el: browserLang,
    search: 'Search',
    searching: `<img src='https://book.cathaypacific.com${staticFilesPath}common/skin/img/icons/cx/icon-loading.gif'> Searching...`,
    searching_w_cancel: `<img src='https://book.cathaypacific.com${staticFilesPath}common/skin/img/icons/cx/icon-loading.gif'> Searching... (Click to Stop)`,
    searching_cont: `<img src='https://book.cathaypacific.com${staticFilesPath}common/skin/img/icons/cx/icon-loading.gif'> Please wait... (Page will refresh)`,
    next_batch: 'Load More...',
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
    no_availability: 'No Redemption Availability',
    expired: 'Search Next 20 (Requires Refresh)',
    super: 'SuperCharged Award Search',
    error: 'Unknown Error... Try Again',
    bulk_batch: 'Batch Search',
    bulk_flights: 'Flights',
    login: 'Reminder: Login before searching.',
    tab_retrieve_fail: 'Failed to retrieve key. Try logging out and in again.',
    key_exhausted: 'Key request quota exhausted, attempting to get new key...',
    getting_key: 'Attempting to retrieve API key...',
    invalid_airport: 'Invalid Airport',
    invalid_code: 'Invalid Destination Code',
    invalid_date: 'Invalid Date',
    saved_queries: 'Saved Flight Queries',
    max_segments: 'Max 6 Sectors Accepted',
    book_multi: 'Book Multi-City Award',
    query: 'Search',
    delete: 'Remove',
    search_selected: 'Search All Saved',
    no_saved: 'You do not have any saved queries. Click on ♥ in batch results to save.',
    loading: 'Searching...',
    human: "Cathay's website needs you to prove you're a human:",
    bot_check: 'Please Complete Cathay Bot Check'
  }

  // ============================================================
  // Search Box
  // ============================================================

  const searchBox = document.createElement('div')
  searchBox.innerHTML = `
    <div class="unelevated_form">
      <div class="unelevated_title"><a href="https://www.cathaypacific.com/cx/${lang.el}_${lang.ec}/book-a-trip/redeem-flights/redeem-flight-awards.html">Unelevated Award Search</a></div>

      <div class="login_prompt hidden"><span class="unelevated_error"><a href="${loginUrl}">${lang.login}</a></span></div>

      <div class="unelevated_faves unelevated_faves_hidden">
        <div class="faves_tabs">
          <a href="javascript:void(0);" class="tabs tab_queries">Routes</a>
          <a href="javascript:void(0);" class="tabs tab_flights">Flights</a>
        </div>
        <a href="javascript:void(0);" class="search_selected">${lang.search_selected} &raquo;</a>
        <div class="saved_flights"></div>
        <div class="saved_queries"></div>
      </div>

      <div class="unelevated_saved">
        <a href="javascript:void(0);">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="heart_save" viewBox="0 0 16 16">
            <path d="M4 1c2.21 0 4 1.755 4 3.92C8 2.755 9.79 1 12 1s4 1.755 4 3.92c0 3.263-3.234 4.414-7.608 9.608a.513.513 0 0 1-.784 0C3.234 9.334 0 8.183 0 4.92 0 2.755 1.79 1 4 1z"></path>
          </svg>
          <span>0</span>
        </a>
      </div>

      <div class="labels">
        <a href="javascript:void(0);" class="switch">
          <svg height="16px" width="16px" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 365.352 365.352" xml:space="preserve" stroke-width="0" transform="rotate(180)">
            <g stroke-width="0"></g>
            <path d="M363.155,169.453l-14.143-14.143c-1.407-1.407-3.314-2.197-5.304-2.197 c-1.989,0-3.897,0.79-5.304,2.197l-45.125,45.125v-57.503c0-50.023-40.697-90.721-90.721-90.721H162.3c-4.143,0-7.5,3.358-7.5,7.5 v20c0,4.142,3.357,7.5,7.5,7.5h40.26c30.725,0,55.721,24.996,55.721,55.721v57.503l-45.125-45.125 c-1.407-1.407-3.314-2.197-5.304-2.197c-1.989,0-3.896,0.79-5.304,2.197l-14.143,14.143c-1.406,1.406-2.196,3.314-2.196,5.303 c0,1.989,0.79,3.897,2.196,5.303l82.071,82.071c1.465,1.464,3.385,2.197,5.304,2.197c1.919,0,3.839-0.732,5.304-2.197 l82.071-82.071c1.405-1.406,2.196-3.314,2.196-5.303C365.352,172.767,364.561,170.859,363.155,169.453z"></path>
            <path d="M203.052,278.14h-40.26c-30.725,0-55.721-24.996-55.721-55.721v-57.503l45.125,45.126 c1.407,1.407,3.314,2.197,5.304,2.197c1.989,0,3.896-0.79,5.304-2.197l14.143-14.143c1.406-1.406,2.196-3.314,2.196-5.303 c0-1.989-0.79-3.897-2.196-5.303l-82.071-82.071c-2.93-2.929-7.678-2.929-10.607,0L2.196,185.292C0.79,186.699,0,188.607,0,190.596 c0,1.989,0.79,3.897,2.196,5.303l14.143,14.143c1.407,1.407,3.314,2.197,5.304,2.197s3.897-0.79,5.304-2.197l45.125-45.126v57.503 c0,50.023,40.697,90.721,90.721,90.721h40.26c4.143,0,7.5-3.358,7.5-7.5v-20C210.552,281.498,207.194,278.14,203.052,278.14z"></path>
          </svg>
        </a>
        <label class="labels_left">
          <span>From</span>
          <input tabindex="1" type="text" id="uef_from" name="uef_from" placeholder="TPE,HKG" value="${uef.from}">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="clearFrom" viewBox="0 0 16 16">
            <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"></path>
          </svg>
          </a>
        </label>
        <label class="labels_right"><span>Adults</span>
        <input tabindex="4" type="number" inputmode="decimal" onClick="this.select()" id="uef_adult" name="uef_adult" placeholder="Adults" value="${uef.adults}" min="0">
        </label>
        <label class="labels_left">
          <span>To</span>
          <input tabindex="2" type="text" id="uef_to" name="uef_to" placeholder="TYO,LHR,SFO" value="${uef.to}">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="clearTo" viewBox="0 0 16 16">
            <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"></path>
          </svg>
        </label>
        <label class="labels_right"><span>Children</span>
        <input tabindex="5" type="number" inputmode="decimal" onClick="this.select()" id="uef_child" name="uef_child" placeholder="Children" value="${uef.children}" min="0">
        </label>
        <label class="labels_left"><span>Date</span>
        <input tabindex="3" class="uef_date" onClick="this.setSelectionRange(6, 8)" id="uef_date" inputmode="decimal" name="uef_date" placeholder="YYYYMMDD" value="${uef.date}">
        </label>
        <button class="uef_search">${lang.search}</button>
      </div>
    </div>

    <div class="multi_box hidden">
      <select id="multi_cabin">
        <option value="Y">${lang.economy_full}</option>
        <option value="W">${lang.premium_full}</option>
        <option value="C">${lang.business_full}</option>
        <option value="F">${lang.first_full}</option>
      </select>
      <label class="labels_right"><span>Adults</span>
      <input type="number" inputmode="decimal" onClick="this.select()" id="multi_adult" name="multi_adult" placeholder="Adults" value="1" min="0">
      </label>
      <label class="labels_right"><span>Children</span>
      <input type="number" inputmode="decimal" onClick="this.select()" id="multi_child" name="multi_child" placeholder="Children" value="0" min="0">
      </label>
      <a href="javascript:void(0)" class="multi_search">${lang.book_multi}</a>
    </div>

    <div class="bulk_box">
      <div class="bulk_results bulk_results_hidden">
        <div class="filters">
          <label><input type="checkbox" data-filter="nonstop" ${filters.nonstop ? 'checked' : ''}>${lang.nonstop}</label>
          <label><input type="checkbox" data-filter="first" ${filters.first ? 'checked' : ''}>${lang.first}</label>
          <label><input type="checkbox" data-filter="business" ${filters.business ? 'checked' : ''}>${lang.business}</label>
          <label><input type="checkbox" data-filter="premium" ${filters.premium ? 'checked' : ''}>${lang.premium}</label>
          <label><input type="checkbox" data-filter="economy" ${filters.economy ? 'checked' : ''}>${lang.economy}</label>
        </div>
        <table class="bulk_table ${filters.nonstop ? 'nonstop_only' : ''} ${filters.first ? 'show_first' : ''} ${filters.business ? 'show_business' : ''} ${filters.premium ? 'show_premium' : ''} ${filters.economy ? 'show_economy' : ''}">
        <thead>
          <th class="bulkDate">${lang.date}</th>
          <th class="bulk_flights">${lang.flights} <span class="info-x info-f">${lang.first}</span><span class="info-x info-j">${lang.business}</span><span class="info-x info-p">${lang.premium}</span><span class="info-x info-y">${lang.economy}</span></th>
        </thead>
        <tbody></tbody>
        </table>
      </div>
      <div class="bulk_footer">
        <div class="bulk_footer_container">
          <button class="bulk_submit">${lang.bulk_batch} ${uef.from} - ${uef.to} ${lang.bulk_flights}</button>
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
    .unelevated_form * {
      box-sizing: border-box;
      -webkit-text-size-adjust: none;
    }

    .unelevated_form a,
    .bulk_box a {
      color: #367778;
    }

    .unelevated_form input:focus {
      outline: none;
    }

    .results_container {
      max-width: 900px;
      margin: 0 auto;
      padding: 20px 20px;
    }

    @media screen and (max-width: 500px) {
      .results_container {
        padding: 20px 10px;
      }
    }

    .cont_query .modal {
      display: none !important;
    }

    .unelevated_form {
      position: relative;
      transition: margin-left 0.7s ease-out;
      z-index: 11;
      font-family: "GT Walsheim", "Cathay Sans EN", CathaySans_Rg, sans-serif;
      border: 1px solid #bcbec0;
      margin: 10px 0;
      background: #f7f6f0;
      padding: 8px 0px 8px 8px;
      border-top: 5px solid #367778;
      box-shadow: 0px 0px 7px rgb(0 0 0 / 20%);
    }

    .unelevated_form.uef_collapsed {
      margin-left: -90%;
    }

    .unelevated_title {
      font-weight: 400;
      font-size: 17px;
      font-family: "GT Walsheim", "Cathay Sans EN", CathaySans_Rg, sans-serif;
      color: #2d2d2d;
      margin: 5px;
      height: 26px;
    }

    .unelevated_title a {
      text-decoration: none;
      color: #2d2d2d;
    }

    .unelevated_form .unelevated_saved {
      position: absolute;
      right: 10px;
      top: 6px;
      background: #ae4b4b;
      display: inline-block;
      border-radius: 5px;
      padding: 3px 10px;
    }

    .unelevated_form .unelevated_saved a,
    .unelevated_form .unelevated_saved a:hover,
    .unelevated_form .unelevated_saved a:active,
    .unelevated_form .unelevated_saved a:focus {
      font-size: 15px;
      line-height: 24px;
      text-decoration: none !important;
      color: white;
      display: block;
      height: 24px;
    }

    .unelevated_form .unelevated_saved svg.heart_save {
      width: 16px;
      margin-right: 6px;
      height: 24px;
      display: inline-block;
    }

    .unelevated_form .unelevated_saved svg.heart_save path {
      fill: #ff8b8b;
    }

    .unelevated_form .unelevated_saved a span {
      vertical-align: top;
      line-height: 24px;
    }

    .unelevated_form .autocomplete-items div:hover {
      background-color: #e9e9e9;
    }

    /* When navigating through the items using the arrow keys */
    .unelevated_form .autocomplete-active {
      background-color: DodgerBlue !important;
      color: #ffffff;
    }

    .feat_title {
      display: block;
      font-size: 17px;
      font-weight: bold;
      margin-bottom: 5px;
      color: #ae4b4b;
    }


    .feat_text {
      display: block;
      font-size: 14px;
      color: #666;
    }

    .unelevated_form .unlock_btn {
      display: block;
      margin: 10px auto;
      padding: 5px;
      border-radius: 5px;
      text-align: center;
      text-decoration: none;
      width: 200px;
      background: linear-gradient(180deg, #fcd54a, #e8b524, #ffd561, #f7eb6d);
      color: rgb(130, 85, 50);
      border: 1px solid #f8c19c;
      box-shadow: -1px 1px 3px rgba(0, 0, 0, 0.3);
      font-weight: bold;
    }

    .unelevated_faves .saved_queries,
    .unelevated_faves.flights .saved_flights {
      display: block;
    }

    .unelevated_faves .saved_flights,
    .unelevated_faves.flights .saved_queries {
      display: none;
    }

    .faves_tabs {
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
      background: #357677;
      color: white;
    }

    .unelevated_faves .tab_flights,
    .unelevated_faves.flights .tab_queries {
      background: #cec9b9;
      color: #444444;
    }

    .unelevated_faves .saved_queries,
    .unelevated_faves .saved_query,
    .unelevated_faves .saved_flights {
      list-style: none;
    }

    .unelevated_faves .saved_queries,
    .unelevated_faves .saved_flights {
      margin: 0 10px;
      padding: 0px;
      border-top: 2px solid #367778;
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      top: 32px;
      overflow: scroll;
    }

    .saved_queries:empty:after,
    .saved_flights:empty:after {
      display: flex;
      content: "You do not have any saved queries. Click on ♥ in batch results to save.";
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
      position: relative;
      margin: 0;
      padding: 3px 10px;
      font-size: 12px;
      font-family: "Cathay Sans EN", CathaySans_Md, sans-serif;
    }

    .unelevated_faves .saved_query label {
      margin: 0;
      min-width: 150px;
      display: inline-block;
    }

    .unelevated_faves .saved_query input,
    .unelevated_faves .saved_flights .saved_flight input {
      vertical-align: -2px;
      margin-right: 5px;
    }

    .unelevated_faves .saved_query:nth-child(odd),
    .unelevated_faves .saved_flights .saved_flight:nth-child(odd) {
      background: #f1efe6;
    }




    .unelevated_faves .saved_flights .saved_flight {
      position: relative;
      margin: 0;
      padding: 3px 10px;
      font-size: 10px;
      font-family: "Cathay Sans EN", CathaySans_Md, sans-serif;
    }

    .unelevated_faves .saved_flights .saved_flight label {
      margin: 0 0 5px 0;
      min-width: 150px;
      display: inline-block;
    }

    .unelevated_faves .saved_flights .saved_flight label>span {
      display: inline-block;
      vertical-align: top;
    }

    span.sf_date {
      display: block;
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

    span.sf_avail>span {
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

    span.sf_avail .av_j {
      background: #002e6c;
    }

    span.sf_avail .av_f {
      background: #832c40;
    }

    span.sf_avail .av_p {
      background: #487c93;
    }

    span.sf_avail .av_y {
      background: #016564;
    }

    .multi_box {
      height: 67px;
      background: #f7f6f0;
      border: 1px solid #bcbec0;
      position: relative;
      margin-top: -11px;
      margin-bottom: -67px;
      z-index: 10;
      padding: 10px;
      box-sizing: border-box;
      display: flex;
      flex-wrap: wrap;
    }

    .multi_box * {
      box-sizing: border-box;
    }

    .multi_box.hidden {
      display: none;
    }

    .multi_box select {
      border: 1px solid #bcbec0;
      height: 45px;
      width: calc(35% - 10px);
      margin-right: 10px;
      display: inline-block;
      vertical-align: top;
      padding: 10px;
    }

    .multi_box label {
      margin: 0;
      display: inline-block;
      position: relative;
      width: calc(20% - 10px);
      margin-right: 10px;
    }

    .multi_box label>span {
      position: absolute;
      top: 0px;
      left: 5px;
      color: #66686a;
      font-family: Cathay Sans EN, CathaySans_Rg, sans-serif;
      line-height: 25px;
      font-size: 10px;
    }

    .multi_box input {
      font-family: Cathay Sans EN, CathaySans_Rg, sans-serif;
      padding: 19px 5px 5px 5px;
      border-radius: 0px;
      border: 1px solid #bcbec0;
      display: inline-block;
      margin: 0px 8px 8px 0px;
      height: 45px;
      width: 100%;
      font-size: 16px;
    }

    .multi_box a.multi_search {
      background-color: #367778;
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
      line-height: 15px;
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

    .unelevated_form .labels {
      display: flex;
      flex-wrap: wrap;
    }

    .unelevated_form .labels label {
      margin: 0;
      display: inline-block;
      position: relative;
      width: 50%;
      padding: 0px 8px 0px 0px;
    }

    .unelevated_form .labels label.labels_left {
      width: 65%;
    }

    .unelevated_form .labels label.labels_right {
      width: 35%;
    }

    .unelevated_form .labels label>span {
      position: absolute;
      top: 0px;
      left: 5px;
      color: #66686a;
      font-family: Cathay Sans EN, CathaySans_Rg, sans-serif;
      line-height: 25px;
      font-size: 10px;
    }

    .unelevated_form .labels input {
      font-family: Cathay Sans EN, CathaySans_Rg, sans-serif;
      padding: 19px 5px 5px 5px;
      border-radius: 0px;
      border: 1px solid #bcbec0;
      display: inline-block;
      margin: 0px 8px 8px 0px;
      height: 45px;
      width: 100%;
      font-size: 16px;
    }

    svg.clearFrom,
    svg.clearTo {
      position: absolute;
      right: 20px;
      top: 15px;
      opacity: 30%;
    }

    .unelevated_form button.uef_search {
      background-color: #367778;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      border: none;
      color: white;
      display: inline-block;
      vertical-align: top;
      margin: 0px;
      height: 45px;
      width: calc(35% - 8px);
      font-size: 15px;
    }


    .heavy_user_prompt {
      background: linear-gradient(339deg, #fdf98b, #e4c63f, #fef985, #eec946);
      box-shadow: -1px 1px 3px rgb(155 95 70 / 40%);
      border-radius: 5px;
      padding: 1px;
      margin-right: 10px;
      margin-top: 10px;
    }

    .heavy_user_prompt a {
      font-size: 15px;
      min-height: 20px;
      padding: 10px;
      line-height: 20px;
      text-decoration: underline !important;
      color: #802d2d;
      display: block;
      background: linear-gradient(180deg, #fcd54a, #e8b524, #ffd561, #f7eb6d);
      border-radius: 5px;
      padding: 10px 8px;
      text-align: center;
    }


    a.uef_toggle,
    a.uef_toggle:hover {
      background: #367778;
      display: block;
      position: absolute;
      right: -1px;
      top: -5px;
      padding-top: 5px;
      width: 30px;
      text-align: center;
      text-decoration: none;
      color: white !important;
      padding-bottom: 5px;
    }

    a.uef_toggle:after {
      content: "«";
    }

    .uef_collapsed a.uef_toggle:after {
      content: "»";
    }

    .bulk_box {
      min-height: 60px;
      transition: margin-top 0.7s ease-out;
      background: #f7f6f0;
      border: 1px solid #bcbec0;
      box-shadow: 0px 0px 7px rgb(0 0 0 / 20%);
      margin-top: -11px !important;
      margin-bottom: 20px;
      z-index: 9;
      position: relative;
    }

    .bulk_box_hidden {
      position: relative;
      margin-top: -80px;
    }

    .bulk_results {
      transition: all 0.5s ease-out;
      min-height: 30px;
      margin: 10px;
    }

    .bulk_results_hidden {
      height: 0;
      min-height: 0;
      margin: 0;
      overflow: hidden;
      transition: all 0.5s ease-out;
    }

    .filters {
      text-align: center;
      font-size: 12px;
      margin-bottom: 10px;
    }

    .filters input {
      vertical-align: -2px;
      margin-right: 5px;
      margin-left: 10px;
    }

    .filters label {
      display: inline-block;
    }

    .bulk_table {
      width: 100%;
      border: 1px solid #c6c2c1;
      margin-top: 3px;
      font-size: 12px;
      border-spacing: 0;
      border-collapse: collapse;
    }

    .bulk_table th {
      text-align: center !important;
      font-weight: bold;
      background: #ebedec;
      line-height: 17px;
      font-size: 12px;
    }

    .bulk_table td {
      background: white;
    }

    .bulk_table tr:nth-child(even) td {
      background: #f9f9f9;
    }

    .bulk_table th,
    .bulk_table td {
      border: 1px solid #c6c2c1;
      padding: 5px;
    }

    .bulk_table .bulkDate {
      width: 80px;
      text-align: center;
    }

    .bulk_table .bulkDate a {
      text-decoration: underline !important;
      font-family: "Cathay Sans EN", CathaySans_Md, sans-serif;
      font-weight: 400;
      display: block;
      margin-bottom: 5px;
    }

    .bulk_table td.bulk_flights {
      padding: 5px 5px 0 5px;
      font-family: "Cathay Sans EN", CathaySans_Rg, sans-serif;
      font-weight: 400;
      line-height: 0px;
    }

    .bulk_table td.bulk_flights .flight_list:empty:after {
      display: block;
      height: 24px;
      content: "No Redemption Availability";
      margin-bottom: 5px;
      margin-top: -3px;
      margin-left: 10px;
      font-family: "Cathay Sans EN", CathaySans_Rg, sans-serif;
      font-weight: 400;
      line-height: 24px;
      color: #AAA;
    }

    .bulk_table td.bulk_flights .flight_list span.bulk_response_error {
      line-height: 24px;
    }

    .bulk_response_error {
      display: block;
      padding-bottom: 5px;
      padding-left: 5px;
      padding-right: 5px;
      color: red;
    }

    .bulk_table .flight_title {
      display: block;
      background: #dde8e8;
      font-size: 12px;
      line-height: 15px;
      padding: 3px 7px;
      margin-bottom: 7px;
      margin-top: 2px;
      border-bottom: 3px solid #357677;
      position: relative;
    }

    .bulk_go_book {
      float: right;
      margin-right: 5px;
      margin-left: 10px;
      font-weight: bold;
    }

    a.bulk_save,
    a.bulk_save:hover,
    a.bulk_save:active {
      outline: none !important;
      float: left;
      margin-right: 5px;
      text-decoration: none !important;
    }

    a.bulk_save svg.heart_save {
      width: 12px;
      height: 12 px;
      display: inline-block;
    }

    a.bulk_save svg.heart_save path {
      fill: gray;
    }

    a.bulk_saved svg.heart_save path {
      fill: #d65656;
    }

    a.bulk_save *,
    a.bulk_go_book * {
      pointer-events: none;
    }

    .flight_wrapper {
      position: relative;
      display: inline-block;
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

    .flight_info>span {
      display: block;
    }

    .flight_info span.info_flight {
      font-weight: bold;
      font-family: CathaySans_Bd, sans-serif;
    }

    .info_dept>span,
    .info_arr>span {
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
      margin-bottom: 5px;
    }

    .flight_item.active+.flight_info {
      display: block;
    }

    .flight_item {
      transition: all 0.5s ease-in;
      background: #e0e0e0;
      line-height: 15px !important;
      border-radius: 5px;
      margin-bottom: 5px;
      white-space: nowrap;
      font-size: 12px;
      font-family: "GT Walsheim", "Cathay Sans EN", CathaySans_Rg, sans-serif;
      font-weight: 400;
      position: relative;
      display: inline-block;
      overflow: hidden;

      max-width: 0px;
      padding: 6px 0px;
      margin-right: 0px;
    }

    .flight_item span.stopover {
      border-radius: 5px;
      padding: 2px 4px;
      color: #909090 !important;
      display: inline-block;
      background: white;
      font-size: 10px;
      margin: 0px 4px !important;
      line-height: 11px;
    }

    .flight_item.direct {
      background: #cbe0cf;
    }

    .flight_item.saved {
      background: #f5ebd8;
    }

    .flight_item img {
      line-height: 15px;
      max-height: 15px;
      vertical-align: middle;
      margin-right: 2px;
      max-width: 20px;
    }

    .show_first .flight_item[data-f="1"],
    .show_business .flight_item[data-j="1"],
    .show_premium .flight_item[data-p="1"],
    .show_economy .flight_item[data-y="1"] {
      max-width: 280px;
      padding: 6px 6px;
      margin-right: 6px;
    }

    .nonstop_only .flight_item[data-direct="0"] {
      max-width: 0px;
      padding: 6px 0px;
      margin-right: 0px;
    }

    span.bulk_j {
      background: #002e6c;
    }

    span.bulk_f {
      background: #832c40;
    }

    span.bulk_p {
      background: #487c93;
    }

    span.bulk_y {
      background: #016564;
    }

    .flight_item span.flight_num {
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
      font-size: 10px;
      overflow: hidden;
      transition: all 0.5s ease-in;
      display: inline-block;
      vertical-align: top;
      height: 16px;
      line-height: 16px;

      max-width: 0px;
      padding: 2px 0px;
      margin-left: 0px;
    }

    .show_first span.bulk_f,
    .show_business span.bulk_j,
    .show_premium span.bulk_p,
    .show_economy span.bulk_y {
      max-width: 25px;
      padding: 2px 5px;
      margin-left: 3px;
    }


    .flight_item:hover img,
    .flight_item:focus img,
    .flight_item:active img,
    .flight_item.saved img {
      opacity: 0;
    }

    span.flight_save {
      display: none;
      position: absolute;
      left: 5px;
      top: 5px;
      opacity: 0.6;
    }

    span.flight_save * {
      pointer-events: none;
    }

    span.flight_save svg {
      height: 12px;
      width: 12px;
      padding: 5px;
    }

    .flight_item.saved span.flight_save {
      opacity: 1;
      display: block;
    }

    .flight_item.saved svg.heart_save path {
      fill: #d65656;
    }

    .flight_item:hover span.flight_save,
    .flight_item:focus span.flight_save,
    .flight_item:active span.flight_save {
      display: inline-block;
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
      transform: rotate(-90deg);
    }

    .flight_item.active .chevron svg {
      transform: rotate(0deg);
    }

    .flight_item * {
      pointer-events: none;
    }

    .flight_item .flight_save {
      pointer-events: auto;
    }

    .bulk_footer {
      min-height: 45px;
      margin: 10px;
    }

    .bulk_footer.bulk_sticky .bulk_footer_container {
      position: fixed;
      bottom: 0;
      padding: 10px;
      background: #f7f6f0;
      margin: 0 auto;
      border-top: 1px solid #c6c2c1;
      box-shadow: 0px 0px 7px rgb(0 0 0 / 20%);
      max-width: 858px;
      left: 0;
      right: 0;
    }

    @media screen and (max-width: 500px) {
      .bulk_footer.bulk_sticky .bulk_footer_container {
        max-width: 838px;
      }
    }

    button.bulk_submit {
      position: relative;
      background-color: #367778;
      border: none;
      color: white;
      margin: 0px auto;
      height: 45px;
      line-height: 35px;
      padding: 5px 0;
      width: 100%;
      display: block;
      font-family: "GT Walsheim", "Cathay Sans EN", CathaySans_Rg, sans-serif !important;
      font-size: 15px;
    }

    .bulk_submit img,
    button.uef_search img {
      line-height: 35px;
      height: 25px;
      width: auto;
      display: inline-block;
      margin-right: 10px;
      vertical-align: -7px;
    }

    .bulkSearching,
    .uef_search.searching {
      background-color: #b9cdc9 !important;
    }

    .col-select-departure-flight>.row:last-of-type {
      padding-bottom: 140px;
    }

    span.info-x {
      border-radius: 5px;
      padding: 2px 5px;
      margin-left: 5px;
      color: white;
      font-size: 10px;
      font-family: CathaySans_Md, Cathay Sans EN;
      font-weight: 400;
    }

    span.info-f {
      background: #832c40;
    }

    span.info-j {
      background: #002e6c;
    }

    span.info-p {
      background: #487c93;
    }

    span.info-y {
      background: #016564;
    }

    .login_prompt {
      height: 40px;
      line-height: 20px;
      overflow: hidden;
      transition: all 0.5s ease-out;
      margin-bottom: 10px;
    }

    .login_prompt.hidden {
      height: 0;
      overflow: hidden;
      margin: 0;
    }

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
      opacity: 1;
    }

    .unelevated_faves_hidden {
      height: 0;
      opacity: 0;
    }

    .unelevated_faves span.saved_title {
      height: 20px;
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
      display: block;
    }

    .flights a.search_selected {
      position: absolute;
      right: 15px;
      top: 6px;
      height: 20px;
      line-height: 20px !important;
      font-size: 12px !important;
      font-weight: bold !important;
      display: none;
    }

    .saved_book {
      margin-left: 10px;
      line-height: 20px !important;
      font-weight: bold;
      display: inline-block;
    }

    .saved_remove {
      font-weight: bold;
      position: absolute;
      line-height: 20px !important;
      font-weight: bold;
      right: 5px;
      top: 3px;
    }

    .flights .saved_remove {
      line-height: 36px !important;
    }

    .multi_on .saved_book,
    .multi_on .saved_remove,
    .multi_on .search_selected {
      display: none;
    }

    .leg {
      color: #ae4b4b !important;
      font-weight: bold;
    }

    .saved_remove svg {
      height: 20px;
      fill: #b4afaf;
    }

    .saved_book *,
    .saved_remove * {
      pointer-events: none;
    }

    span.unelevated_error {
      padding: 10px 0 10px 10px;
      line-height: 20px;
      max-height: 100%;
      display: block;
      background: #ffd2d2;
      border-radius: 5px;
      margin: 0 10px 5px 0;
      text-align: center;
      color: #b54545;
      font-weight: bold;
      font-size: 14px;
    }

    span.unelevated_error a {
      padding: 0;
      margin: 0;
      text-decoration: underline;
      line-height: 20px;
      max-height: 100%;
      height: 24px;
      display: block;
      background: #ffd2d2;
      border-radius: 5px;
      margin: 0 10px 5px 0;
      text-align: center;
      color: #b54545;
      font-family: CathaySans_Md, Cathay Sans EN;
      font-weight: 400;
    }

    .bulk_error span {
      padding: 5px;
      line-height: 20px;
      height: 20px;
      max-height: 100%;
      display: block;
      background: #eae6d9;
      border-radius: 5px;
      text-align: center;
      color: #b54545;
      margin-top: 10px;
      font-size: 12px;
      transition: all 0.5s ease-out;
      font-family: CathaySans_Md, Cathay Sans EN;
      font-weight: 400;
    }

    .bulk_error_hidden span {
      height: 0;
      margin-top: 0;
      overflow: hidden;
      padding: 0;
    }

    /* The container must be positioned relative */
    .unelevated_form .autocomplete {
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
      right: 8px;
      ;
      margin-top: -8px;
      max-height: 200px;
      overflow: scroll;
      background: white;
    }

    .unelevated_form .autocomplete-items div {
      padding: 5px;
      cursor: pointer;
      background-color: #fff;
      border-bottom: 1px solid #e4e4e4;
      font-size: 12px;
      font-weight: normal;
      font-family: "Cathay Sans EN", CathaySans_Rg, sans-serif;
      white-space: nowrap;
      overflow: hidden;
    }

    .unelevated_form .autocomplete-items div span.sa_code {
      margin-left: 5px;
      display: inline-block;
      width: 30px;
      font-weight: normal;
    }

    .unelevated_form .autocomplete-items div span.sc_code {
      color: #888;
      display: inline-block;
      margin-left: 10px;
      font-weight: normal;
    }

    /* When hovering an item */
    .unelevated_form .autocomplete-items div:hover {
      background-color: #e9e9e9;
    }

    /* When navigating through the items using the arrow keys */
    .unelevated_form .autocomplete-active,
    .unelevated_form div.autocomplete-active span.sc_code {
      background-color: DodgerBlue !important;
      color: #ffffff;
    }
  `

  addCss(`
    .captcha_wrapper {
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

  let btnSearch: HTMLButtonElement, btnBatch: HTMLButtonElement
  let inputFrom: HTMLInputElement, inputTo: HTMLInputElement, inputDate: HTMLInputElement, inputAdult: HTMLInputElement, inputChild: HTMLInputElement, inputMultiAdult: HTMLInputElement, inputMultiChild: HTMLInputElement
  let selectMultiCabin: HTMLSelectElement
  let clearFrom: SVGElement, clearTo: SVGElement
  let linkSearchSaved: HTMLAnchorElement, linkSearchMulti: HTMLAnchorElement
  let divFilters: HTMLDivElement, divLoginPrompt: HTMLDivElement, divFooter: HTMLDivElement, divUeContainer: HTMLDivElement, divHeartSave: HTMLDivElement, divSaved: HTMLDivElement, divFavesTabs: HTMLDivElement, divSavedQueries: HTMLDivElement, divSavedFlights: HTMLDivElement, divMultiBox: HTMLDivElement, divResults: HTMLDivElement, divError: HTMLDivElement
  let divTable: HTMLTableElement, divTableBody: HTMLTableSectionElement
  let savedCount: HTMLSpanElement

  const assignElements = (): void => {
    log('assignElements()')

    btnSearch = shadowRoot.querySelector('.uef_search') // Search Button
    btnBatch = shadowRoot.querySelector('.bulk_submit') // Batch Search Button

    inputFrom = shadowRoot.querySelector('#uef_from')
    inputTo = shadowRoot.querySelector('#uef_to')
    inputDate = shadowRoot.querySelector('#uef_date')
    inputAdult = shadowRoot.querySelector('#uef_adult')
    inputChild = shadowRoot.querySelector('#uef_child')
    inputMultiAdult = shadowRoot.querySelector('#multi_adult')
    inputMultiChild = shadowRoot.querySelector('#multi_child')

    selectMultiCabin = shadowRoot.querySelector('#multi_cabin')

    clearFrom = shadowRoot.querySelector('.clearFrom')
    clearTo = shadowRoot.querySelector('.clearTo')

    linkSearchSaved = shadowRoot.querySelector('.search_selected')
    linkSearchMulti = shadowRoot.querySelector('.multi_search')

    divFilters = shadowRoot.querySelector('.filters')
    divLoginPrompt = shadowRoot.querySelector('.login_prompt')
    divFooter = shadowRoot.querySelector('.bulk_footer')
    divUeContainer = shadowRoot.querySelector('.unelevated_form')
    divHeartSave = shadowRoot.querySelector('.unelevated_saved')
    divSaved = shadowRoot.querySelector('.unelevated_faves')
    divFavesTabs = shadowRoot.querySelector('.unelevated_faves .faves_tabs')
    divSavedFlights = shadowRoot.querySelector('.unelevated_faves .saved_flights')
    divSavedQueries = shadowRoot.querySelector('.unelevated_faves .saved_queries')
    divMultiBox = shadowRoot.querySelector('.multi_box')
    divResults = shadowRoot.querySelector('.bulk_results')
    divError = shadowRoot.querySelector('.bulk_error')

    divTable = shadowRoot.querySelector('.bulk_table')
    divTableBody = shadowRoot.querySelector('.bulk_table tbody')

    savedCount = shadowRoot.querySelector('.unelevated_saved a span')
  }

  const addFormListeners = (): void => {
    log('addFormListeners()')

    btnSearch.addEventListener('click', (e) => {
      void (async () => {
        uef.from = inputFrom.value
        uef.to = inputTo.value
        uef.date = inputDate.value
        uef.adults = parseInt(inputAdult.value)
        uef.children = parseInt(inputChild.value)
        await valueSet('uef', uef)

        await regularSearch([{
          from: uef.from.substring(0, 3),
          to: uef.to.substring(0, 3),
          date: uef.date
        }], {
          adults: uef.adults,
          children: uef.children
        }, 'Y', { batch: false, query: uef.to.length > 3, saved: false })
      })()
    })

    btnBatch.addEventListener('click', (e) => {
      void (async () => {
        await bulkClick()
      })()
    })

    shadowRoot.querySelector('.switch').addEventListener('click', (e) => {
      const from = inputFrom.value
      const to = inputTo.value
      inputFrom.value = to
      inputTo.value = from
      inputFrom.dispatchEvent(new Event('change'))
      inputTo.dispatchEvent(new Event('change'))
    })

    let inFocus = false;

    [inputFrom, inputTo].forEach((el) => {
      el.addEventListener('keyup', (e) => {
        if (['Enter', ' ', ','].includes(e.key)) {
          if (e.key === 'Enter') el.value += ','
          el.value = el.value.toUpperCase().split(/[ ,]+/).join(',')
        }
      })

      el.addEventListener('change', (e) => {
        el.value = el.value.toUpperCase().split(/[ ,]+/).join(',').replace(/,+$/, '')
        // setTimeout(fn, 0) lets the page reflect the updated DOM
        setTimeout(() => {
          checkAirportCodes(el)
          if (el === inputFrom) {
            uef.from = el.value
          } else {
            uef.to = el.value
          }
          routeChanged = true
          if (!searching) btnBatch.innerHTML = `${lang.bulk_batch} ${uef.from} - ${uef.to} ${lang.bulk_flights}`
        }, 0)
      })

      el.addEventListener('focus', (e) => {
        if (el.value.length) el.value += ','
      })

      el.addEventListener('click', (e) => {
        if (!inFocus) el.setSelectionRange(el.value.length, el.value.length)
        inFocus = true
      })

      el.addEventListener('blur', (e) => {
        el.value = el.value.replace(/,+$/, '')
        inFocus = false
      })
    })

    inputDate.addEventListener('change', (e) => {
      if (isValidDate(inputDate.value)) {
        routeChanged = true
        if (!searching) btnBatch.innerHTML = `${lang.bulk_batch} ${uef.from} - ${uef.to} ${lang.bulk_flights}`
      } else {
        alert(lang.invalid_date)
        inputDate.value = uef.date
      }
    })

    clearFrom.addEventListener('click', (e) => {
      inputFrom.value = ''
    })

    clearTo.addEventListener('click', (e) => {
      inputTo.value = ''
    })

    divTable.addEventListener('click', (e) => {
      void (async () => {
        if ((e.target as HTMLElement).tagName !== 'A') return
        const el = e.target as HTMLAnchorElement

        if ('book' in el.dataset) {
          stopBatch()
          // stopSearch = true
          // searching = false
          el.innerText = lang.loading
          await regularSearch([{
            // TODO: Why does this need a fallback value?
            from: el.dataset.from ?? uef.from.substring(0, 3),
            to: el.dataset.dest ?? uef.to.substring(0, 3),
            date: el.dataset.date
          }], {
            adults: uef.adults,
            children: uef.children
          })
        } else if ('save' in el.dataset) {
          const key = `${el.dataset.date}${el.dataset.from}${el.dataset.dest}`
          if (el.classList.contains('bulk_saved')) {
            el.classList.remove('bulk_saved')
            savedQueries.delete(key)
            updateSavedCount()
          } else {
            el.classList.add('bulk_saved')
            savedQueries.add(key)
            updateSavedCount()
          }
          await valueSet('saved_queries', Array.from(savedQueries))
        }
      })()
    })

    divTable.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).tagName !== 'DIV') return
      const el = e.target as HTMLDivElement

      if (el.classList.contains('flight_item')) {
        if (el.classList.contains('active')) {
          el.classList.remove('active')
        } else {
          shadowRoot.querySelectorAll<HTMLDivElement>('.flight_item').forEach((el) => {
            el.classList.remove('active')
          })
          el.classList.add('active')
        }
      }
    })

    divTable.addEventListener('click', (e) => {
      void (async () => {
        if ((e.target as HTMLElement).tagName !== 'SPAN') return
        const el = e.target as HTMLSpanElement

        if (el.classList.contains('flight_save')) {
          const flightItem = el.parentNode as HTMLDivElement
          const key = flightItem.dataset.flightInfo
          const flightAvail = flightItem.dataset.flightAvail.split('_')
          if (flightItem.classList.contains('saved')) {
            flightItem.classList.remove('saved')
            delete savedFlights[key]
            updateSavedFlights()
          } else {
            flightItem.classList.add('saved')
            savedFlights[key] = {
              F: parseInt(flightAvail[0]),
              J: parseInt(flightAvail[1]),
              P: parseInt(flightAvail[2]),
              Y: parseInt(flightAvail[3])
            }
            updateSavedFlights()
          }
          await valueSet('saved_flights', savedFlights)
        }
      })()
    })

    document.addEventListener('scroll', (e) => {
      shadowRoot.querySelectorAll<HTMLDivElement>('.flight_item').forEach((el) => {
        el.classList.remove('active')
      })
    })

    divSaved.addEventListener('click', (e) => {
      void (async () => {
        const el = e.target as HTMLElement

        if (el.dataset.remove != null) {
          delete savedFlights[el.dataset.remove]
          savedQueries.delete(el.dataset.remove)
          updateSavedCount()
          updateSavedFlights()
          await valueSet('saved_flights', savedFlights)
          await valueSet('saved_queries', Array.from(savedQueries))
        }
      })()
    })

    divSavedQueries.addEventListener('click', (e) => {
      void (async () => {
        if ((e.target as HTMLElement).tagName !== 'A') return
        const el = e.target as HTMLAnchorElement

        if ('book' in el.dataset) {
          stopBatch()
          el.innerText = lang.loading
          await regularSearch([{
            // TODO: Why does this need a fallback value?
            from: el.dataset.from ?? uef.from,
            to: el.dataset.dest ?? uef.to,
            date: el.dataset.date
          }], {
            adults: 1,
            children: 0
          })
        }
      })()
    })

    divSavedQueries.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).tagName !== 'INPUT') return
      const el = e.target as HTMLInputElement

      const selectedSegments = divSavedQueries.querySelectorAll<HTMLDivElement>('.selected')

      selectedSegments.forEach((el) => {
        delete el.dataset.new
      })

      const savedQuery = el.parentNode.parentNode as HTMLDivElement
      if (el.checked) {
        savedQuery.dataset.new = ''
        savedQuery.classList.add('selected')
        divSaved.classList.add('multi_on')
        divMultiBox.classList.remove('hidden')
      } else {
        savedQuery.classList.remove('selected')
        savedQuery.querySelector<HTMLSpanElement>('.leg').innerText = ''
        delete savedQuery.dataset.segment
        if (!selectedSegments.length) {
          divSaved.classList.remove('multi_on')
          divMultiBox.classList.add('hidden')
        }
      }

      if (selectedSegments.length === 6) {
        Array.from(divSavedQueries.getElementsByTagName('input')).forEach((el) => {
          if (!el.checked) el.disabled = true
        })
      } else {
        Array.from(divSavedQueries.getElementsByTagName('input')).forEach((el) => {
          el.disabled = false
        })
      }

      Array.from(selectedSegments).sort((a, b) => {
        if (+a.dataset.date > +b.dataset.date) return 1
        log(a.dataset.date, b.dataset.date)
        if (a.dataset.date === b.dataset.date) return ('new' in a.dataset ? 1 : (a.dataset.segment > b.dataset.segment ? 1 : -1))
        return 0
      }).forEach((el, index) => {
        el.dataset.segment = (index + 1).toString()
        el.querySelector<HTMLSpanElement>('.leg').innerText = `Segment ${index + 1}`
      })
    })

    const filterToClassName = (filter: string): string => {
      switch (filter) {
        case 'nonstop':
          return `${filter}_only`
        case 'first':
        case 'business':
        case 'premium':
        case 'economy':
          return `show_${filter}`
        default:
          throw new Error(`Unknown filter "${filter}"`)
      }
    }

    Array.from(divFilters.getElementsByTagName('input')).forEach((el) => {
      el.addEventListener('click', (e) => {
        void (async () => {
          const className = filterToClassName(el.dataset.filter)
          filters[el.dataset.filter] = el.checked
          await valueSet('filters', filters)

          if (el.checked) {
            divTable.classList.add(className)
          } else {
            divTable.classList.remove(className)
          }
        })()
      })
    })

    linkSearchSaved.addEventListener('click', (e) => {
      void (async () => {
        if (!savedQueries.size) {
          alert('No Saved Queries')
          return
        }

        linkSearchSaved.innerText = lang.loading
        await savedSearch()
      })()
    })

    linkSearchMulti.addEventListener('click', (e) => {
      void (async () => {
        const selectedSegments = divSavedQueries.querySelectorAll<HTMLDivElement>('.selected')
        if (!selectedSegments.length) {
          alert('No Selected Segments')
          return
        }

        linkSearchMulti.innerText = lang.loading
        const toSearch: Query[] = []
        Array.from(selectedSegments).sort((a, b) => parseInt(a.dataset.segment) - parseInt(b.dataset.segment)).forEach((segment) => {
          toSearch.push({
            date: segment.dataset.date,
            from: segment.dataset.route.substring(0, 3),
            to: segment.dataset.route.substring(3, 6)
          })
        })
        await regularSearch(toSearch, {
          adults: parseInt(inputMultiAdult.value),
          children: parseInt(inputMultiChild.value)
        }, selectMultiCabin.value as CabinClass)
      })()
    })

    divFavesTabs.addEventListener('click', (e) => {
      const el = e.target as HTMLElement

      if (el.classList.contains('tab_flights')) {
        divSaved.classList.add('flights')
      } else if (el.classList.contains('tab_queries')) {
        divSaved.classList.remove('flights')
      }
    })

    divHeartSave.addEventListener('click', (e) => {
      // alert(JSON.stringify(saved))
      divSaved.classList.toggle('unelevated_faves_hidden')
    })
  }

  // ============================================================
  // Data Retrievers
  // ============================================================

  const airports: Airports = {}

  const loadAirports = async (): Promise<void> => {
    log('loadAirports()')

    const resp = await httpRequest(`https://api.cathaypacific.com/redibe/airport/origin/${lang.el}/`)

    const data = JSON.parse((await resp.text()).replace('Taiwan China', 'Taiwan'))
    if (data.airports) {
      data.airports.forEach(({ airportCode, countryName, shortName }: Airport) => {
        airports[airportCode] = { airportCode, countryName, shortName }
      })
    }
  }

  // ============================================================
  // UI Logic
  // ============================================================

  const batchError = (label?: string): void => {
    if (label == null) {
      divError.classList.add('bulk_error_hidden')
    } else {
      shadowRoot.querySelector('.bulk_error span').innerHTML = label
      divError.classList.remove('bulk_error_hidden')
    }
  }

  // Arguments: the text field element and an array of possible autocomplete values
  const autocomplete = (input: HTMLInputElement, values: Airports): void => {
    let currentFocus: number
    // Execute a function when someone writes in the text field
    input.addEventListener('input', (e) => {
      newAC(input, e)
    })
    // input.addEventListener('click', (e) => {
    //   newAC(input, e)
    // })
    // Execute a function presses a key on the keyboard
    input.addEventListener('keydown', (e) => {
      const divContainer = shadowRoot.getElementById(`${input.id}-autocomplete-list`) as HTMLDivElement
      if (divContainer == null) return

      const divMatches = divContainer.getElementsByTagName('div')
      if (e.key === 'ArrowDown') {
        currentFocus++
        setActive(divMatches)
      } else if (e.key === 'ArrowUp') {
        currentFocus--
        setActive(divMatches)
      } else if (e.key === 'Enter') {
        // Prevent the form from being submitted
        e.preventDefault()
        closeAllLists()
        if (currentFocus > -1) {
          // Simulate a click on the "active" item
          if (divMatches) divMatches[currentFocus].click()
        } else if (divMatches) {
          divContainer.querySelector<HTMLDivElement>(':not').click()
        }
      } else if (['Tab', ' '].includes(e.key)) {
        closeAllLists()
        // Simulate a click on the first item
        if (divMatches) divMatches[0].click()
      }
    })

    // Classify an item as "active"
    const setActive = (divMatches: HTMLCollectionOf<HTMLDivElement>): void => {
      if (!divMatches) return
      // Start by removing the "active" class on all items
      removeActive(divMatches)
      if (currentFocus >= divMatches.length) currentFocus = 0
      if (currentFocus < 0) currentFocus = divMatches.length - 1
      // Add class "autocomplete-active"
      divMatches[currentFocus].classList.add('autocomplete-active')
    }

    // Remove the "active" class from all autocomplete items
    const removeActive = (divMatches: HTMLCollectionOf<HTMLDivElement>): void => {
      for (let i = 0; i < divMatches.length; i++) {
        divMatches[i].classList.remove('autocomplete-active')
      }
    }

    // Close all autocomplete lists in the document, except the one passed as an argument
    const closeAllLists = (el?: HTMLElement): void => {
      const x = shadowRoot.querySelectorAll('.autocomplete-items')
      for (let i = 0; i < x.length; i++) {
        if (el !== x[i] && el !== input) {
          x[i].parentNode.removeChild(x[i])
        }
      }
    }

    const newAC = (el: HTMLInputElement, e: Event): void => {
      // Close any already open lists of autocomplete values
      closeAllLists()
      const val = (el.value.match(/[^,]+$/) != null) ? el.value.match(/[^,]+$/)[0] : false
      if (!val) return

      currentFocus = -1

      // Create a DIV element that will contain the items (values)
      const divContainer = document.createElement('div')
      divContainer.setAttribute('id', `${el.id}-autocomplete-list`)
      divContainer.setAttribute('class', 'autocomplete-items')

      // Append the DIV element as a child of the autocomplete container
      el.parentNode.appendChild(divContainer)
      const sep = document.createElement('span')
      sep.style.display = 'none'
      divContainer.appendChild(sep)

      const favs = ['TPE', 'TSA', 'KHH', 'RMQ', 'TYO', 'HND', 'NRT', 'KIX', 'ITM', 'CTS', 'FUK', 'NGO', 'OKA', 'ICN', 'PUS', 'GMP', 'CJU', 'HKG', 'MFM', 'BKK', 'CNX', 'HKT', 'CGK', 'DPS', 'SUB', 'KUL', 'BKI', 'PEN', 'DAD', 'HAN', 'SGN', 'CEB', 'MNL', 'SIN', 'PNH', 'DEL', 'BOM', 'DXB', 'DOH', 'TLV', 'BCN', 'MAD', 'MXP', 'CDG', 'ZRH', 'MUC', 'FCO', 'FRA', 'CDG', 'AMS', 'LHR', 'LGW', 'LON', 'MAN', 'FCO', 'BOS', 'JFK', 'YYZ', 'ORD', 'IAD', 'YVR', 'SFO', 'LAX', 'SAN', 'SEA', 'JNB', 'PER', 'SYD', 'BNE', 'MEL', 'AKL', 'HEL', 'BLR', 'SHA', 'PVG', 'PEK', 'CAN', 'KTM', 'ADL', 'CPT', 'ATH', 'IST', 'SOF', 'VCE', 'BUD', 'PRG', 'VIE', 'BER', 'WAW', 'KBP', 'CPH', 'DUS', 'BRU', 'OSL', 'ARN', 'DUB', 'MIA', 'ATL', 'IAH', 'DFW', 'PHL', 'CMN', 'LAS', 'SJC', 'DEN', 'AUS', 'MSY', 'MCO', 'EWR', 'NYC', 'LIS', 'OPO', 'SPU', 'DBV', 'ZAG', 'MLE', 'LIM', 'BOG', 'CNS', 'GRU', 'SCL', 'GIG', 'EZE', 'MEX', 'CUN']
      // For each autocomplete value, check if it starts with the same letters as the text field value
      Object.values(values).forEach(({ airportCode, countryName, shortName }) => {
        if (airportCode.length > 3) return
        if (val.toUpperCase() === airportCode.substr(0, val.length).toUpperCase() || val.toUpperCase() === countryName.substr(0, val.length).toUpperCase() || val.toUpperCase() === shortName.substr(0, val.length).toUpperCase()) {
          const sa = airportCode.substr(0, val.length).toUpperCase() === val.toUpperCase() ? val.length : 0
          const se = shortName.substr(0, val.length).toUpperCase() === val.toUpperCase() ? val.length : 0
          const sc = countryName.substr(0, val.length).toUpperCase() === val.toUpperCase() ? val.length : 0
          // Create a DIV element for each matching element
          const divMatch = document.createElement('div')
          // Make the matching letters bold
          let c = `<span class='sa_code'><strong>${airportCode.substr(0, sa)}</strong>${airportCode.substr(sa)}</span>`
          c += `<span class='sc_code'><strong>${shortName.substr(0, se)}</strong>${shortName.substr(se)}`
          c += ` - <strong>${countryName.substr(0, sc)}</strong>${countryName.substr(sc)}</span>`
          c += '</span>'
          // Insert a input field that will hold the current array item's value
          c += `<input type='hidden' value='${airportCode}'>`
          divMatch.dataset.airportCode = airportCode
          divMatch.innerHTML = c
          // Execute a function when someone clicks on the item value (DIV element)
          divMatch.addEventListener('click', (e) => {
            const el = e.target as HTMLElement

            // Insert the value for the autocomplete text field
            input.value = [input.value.replace(/([,]?[^,]*)$/, ''), el.dataset.airportCode].filter(Boolean).join(',')
            input.dispatchEvent(new Event('change'))
            // Close the list of autocomplete values (or any other open lists of autocomplete values)
            closeAllLists()
          })

          if (['TPE', 'KHH', 'HKG'].includes(airportCode)) {
            divContainer.prepend(divMatch)
          } else if (favs.includes(airportCode)) {
            divContainer.insertBefore(divMatch, sep)
          } else {
            divContainer.appendChild(divMatch)
          }
        }
      })
    }
    // Execute a function when someone clicks in the document
    document.addEventListener('click', (e) => {
      if (e.target === input) return
      closeAllLists(e.target as HTMLElement)
    })
  }

  // ============================================================
  // Application Logic
  // ============================================================

  let searching = false
  let stopSearch = false
  let remainingDays = 20

  const resetSearch = (): void => {
    searching = false
    remainingDays = 20
    btnBatch.innerHTML = `${lang.bulk_batch} ${uef.from} - ${uef.to} ${lang.bulk_flights}`
    btnBatch.classList.remove('bulkSearching')
    linkSearchSaved.innerText = `${lang.search_selected} »`
  }

  const stopBatch = (): void => {
    log('Batch Clicked. Stopping Search')

    stopSearch = true
    resetSearch()
    if (!routeChanged) btnBatch.innerHTML = lang.next_batch // Override resetSearch()
    batchError()
  }

  const bulkClick = async (singleDate = false): Promise<void> => {
    if (searching) {
      stopBatch()
      return
    }

    log('Batch Clicked. Starting Search')

    uef.from = inputFrom.value
    uef.to = inputTo.value
    uef.date = inputDate.value
    uef.adults = parseInt(inputAdult.value)
    uef.children = parseInt(inputChild.value)
    await valueSet('uef', uef)

    if (routeChanged) {
      bulkDate = uef.date
      routeChanged = false

      divTableBody.innerHTML = ''
      divUeContainer.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
    }

    divResults.classList.remove('bulk_results_hidden')
    btnBatch.innerHTML = lang.searching_w_cancel
    btnBatch.classList.add('bulkSearching')
    await bulkSearch(singleDate)
  }

  const savedSearch = async (): Promise<void> => {
    const toSearch: Query[] = []
    savedQueries.forEach((query) => {
      toSearch.push({
        date: query.substring(0, 8),
        from: query.substring(8, 11),
        to: query.substring(11, 14)
      })
    })
    toSearch.sort((a, b) => parseInt(a.date) - parseInt(b.date))

    let ssQuery = toSearch.shift()

    divResults.classList.remove('bulk_results_hidden')
    btnBatch.innerHTML = lang.searching_w_cancel
    btnBatch.classList.add('bulkSearching')
    divTableBody.innerHTML = ''

    if (!cont.query) {
      await regularSearch([{
        from: ssQuery.from,
        to: ssQuery.to,
        date: ssQuery.date
      }], {
        adults: 1,
        children: 0
      }, 'Y', { batch: false, query: true, saved: true })
      return
    }

    const populateNextQuery = async (pageBom): Promise<void> => {
      insertResults(ssQuery.from, ssQuery.to, ssQuery.date, pageBom)

      if (toSearch.length > 0) {
        ssQuery = toSearch.shift()
        await searchAvailability(ssQuery.from, ssQuery.to, ssQuery.date, 1, 0, populateNextQuery)
      } else {
        stopBatch()
        stopSearch = false // Override stopBatch()
      }
    }

    // You can't resume a saved search after stopping it
    // It will actually start a bulk search and append the results to the saved search results
    routeChanged = true // To clear the saved search results
    // TODO: Make sure the button changes back to a normal bulk search button

    await searchAvailability(ssQuery.from, ssQuery.to, ssQuery.date, 1, 0, populateNextQuery)
  }

  const updateSavedCount = (): void => {
    log('updateSavedCount()')

    let savedList = ''
    const savedArr: Query[] = []
    savedQueries.forEach((query) => {
      const savedDate = new Date(+query.substring(0, 4), +query.substring(4, 6) - 1, +query.substring(6, 8))
      const today = new Date()
      if (savedDate <= today) {
        savedQueries.delete(query)
        return
      }
      savedArr.push({
        date: query.substring(0, 8),
        from: query.substring(8, 11).toUpperCase(),
        to: query.substring(11, 14).toUpperCase()
      })
    })
    savedArr.sort((a, b) => parseInt(a.date) - parseInt(b.date))

    savedArr.forEach((query) => {
      const date = query.date
      const from = query.from
      const to = query.to
      savedList += `
        <div class="saved_query" data-date="${date}" data-route="${from}${to}">
          <label><input type="checkbox" data-date="${date}" data-route="${date}${from}${to}"> ${dateStringToDashedDateString(date)} ${from}-${to}</label>
          <a href="javascript:void(0);" class="saved_book" data-book data-date="${date}" data-from="${from}" data-dest="${to}">${lang.query} &raquo;</a>
          <span class="leg"></span>
          <a href="javascript:void(0);" class="saved_remove" data-remove="${date}${from}${to}">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="saved_delete" viewBox="0 0 16 16">
              <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"></path>
            </svg>
          </a>
        </div>
      `
    })
    divSavedQueries.innerHTML = savedList
    savedCount.innerText = savedArr.length.toString()
  }

  const updateSavedFlights = (): void => {
    log('updateSavedFlights()')

    let savedList = ''
    const savedArr: Flight[] = []
    Object.keys(savedFlights).forEach((query) => {
      const savedDate = new Date(+query.substring(0, 4), +query.substring(4, 6) - 1, +query.substring(6, 8))
      const today = new Date()
      if (savedDate <= today) {
        delete savedFlights[query]
        return
      }
      savedArr.push({
        fullQuery: query,
        date: query.substring(0, 8),
        from: query.substring(8, 11).toUpperCase(),
        to: query.substring(11, 14).toUpperCase(),
        leg1: query.split('_')[1] ?? '',
        stop: query.split('_')[2] ?? '',
        leg2: query.split('_')[3] ?? '',
        F: savedFlights[query].F,
        J: savedFlights[query].J,
        P: savedFlights[query].P,
        Y: savedFlights[query].Y
      })
    })
    savedArr.sort((a, b) => parseInt(a.date) - parseInt(b.date))

    savedArr.forEach((query) => {
      const fullQuery = query.fullQuery
      const date = query.date
      const from = query.from
      const to = query.to
      const leg1 = query.leg1
      const stop = query.stop
      const leg2 = query.leg2
      const avail = {
        F: query.F,
        J: query.J,
        P: query.P,
        Y: query.Y
      }
      savedList += `
        <div class="saved_flight" data-date="${date}" data-route="${from}${to}">
          <label>
          <input type="checkbox" data-date="${date}" data-route="${date}${from}${to}">
          <span>
            <span class="sf_date">${dateStringToDashedDateString(date)}</span>
            <span class="sf_route">${from}-${stop ? `${stop}-` : ''}${to}</span>
            <span class="sf_flights">
              ${leg1}${leg2 ? ` + ${leg2}` : ''}
              <span class="sf_avail">
                ${avail.F ? `<span class="av_f">F ${avail.F}</span>` : ''}
                ${avail.J ? `<span class="av_j">J ${avail.J}</span>` : ''}
                ${avail.P ? `<span class="av_p">PY ${avail.P}</span>` : ''}
                ${avail.Y ? `<span class="av_y">Y ${avail.Y}</span>` : ''}
              </span>
            </span>
          </span>
          </label>
          <a href="javascript:void(0);" class="saved_book" data-book "data-date="${date}" data-from="${from}" data-dest="${to}">${lang.query} &raquo;</a>
          <span class="leg"></span>
          <a href="javascript:void(0);" class="saved_remove" data-remove="${fullQuery}">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="saved_delete" viewBox="0 0 16 16">
              <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"></path>
            </svg>
          </a>
        </div>
      `
    })
    divSavedFlights.innerHTML = savedList
    savedCount.innerText = savedArr.length.toString()
  }

  const checkAirportCodes = (el: HTMLInputElement): void => {
    log('checkAirportCodes()')

    let airportCodes = el.value.split(',')
    const errorAirportCodes: string[] = []
    airportCodes = airportCodes.filter((airportCode) => {
      if (airports[airportCode] != null) return true
      if (airportCode) errorAirportCodes.push(airportCode)
      return false
    })

    if (errorAirportCodes.length > 0) {
      el.value = airportCodes.join(',')
      alert(`Removing ${lang.invalid_airport}${errorAirportCodes.length > 1 ? 's' : ''}: ${errorAirportCodes.join(',')}`)
    }
  }

  const checkLogin = async (): Promise<void> => {
    log('checkLogin()')

    const resp = await httpRequest('https://api.cathaypacific.com/redibe/login/getProfile', {
      headers: { 'Content-Type': 'application/json' },
      withCredentials: true
    })

    log('getProfile')
    const data = await resp.json()
    if (!data.membershipNumber) divLoginPrompt.classList.remove('hidden')
  }

  // ============================================================
  // Request Variables
  // ============================================================

  // Default Search JSON

  const newQueryPayload = (route: Query = {
    date: dateAdd(1),
    from: 'HND',
    to: 'ITM'
  }, passengers: Passengers = {
    adults: 1,
    children: 0
  }, cabinClass: CabinClass = 'Y') => {
    log('newQueryPayload()')

    return {
      awardType: 'Standard',
      brand: 'CX',
      cabinClass,
      entryCountry: lang.ec,
      entryLanguage: lang.el,
      entryPoint: `https://www.cathaypacific.com/cx/${lang.el}_${lang.ec}/book-a-trip/redeem-flights/redeem-flight-awards.html`,
      errorUrl: `https://www.cathaypacific.com/cx/${lang.el}_${lang.ec}/book-a-trip/redeem-flights/redeem-flight-awards.html?recent_search=ow`,
      returnUrl: `https://www.cathaypacific.com/cx/${lang.el}_${lang.ec}/book-a-trip/redeem-flights/redeem-flight-awards.html?recent_search=ow`,
      isFlexibleDate: false,
      numAdult: passengers.adults,
      numChild: passengers.children,
      promotionCode: '',
      segments: [{
        departureDate: route.date,
        origin: route.from,
        destination: route.to
      }]
    }
  }

  const newMultiPayload = (routes: Query[], passengers: Passengers, cabinClass: CabinClass = 'Y') => {
    log('newMultiPayload()')

    const segments = []
    routes.forEach((segment) => {
      segments.push({
        departureDate: segment.date,
        origin: segment.from,
        destination: segment.to
      })
    })
    return {
      awardType: 'Standard',
      brand: 'CX',
      cabinClass,
      entryCountry: lang.ec,
      entryLanguage: lang.el,
      entryPoint: `https://www.cathaypacific.com/cx/${lang.el}_${lang.ec}/book-a-trip/redeem-flights/redeem-flight-awards.html`,
      errorUrl: `https://www.cathaypacific.com/cx/${lang.el}_${lang.ec}/book-a-trip/redeem-flights/redeem-flight-awards.html?recent_search=mc`,
      returnUrl: `https://www.cathaypacific.com/cx/${lang.el}_${lang.ec}/book-a-trip/redeem-flights/redeem-flight-awards.html?recent_search=mc`,
      isFlexibleDate: false,
      numAdult: passengers.adults,
      numChild: passengers.children,
      promotionCode: '',
      segments
    }
  }

  // ============================================================
  // Get New TAB_ID
  // ============================================================

  const responseParser = (response: string, regex: RegExp) => {
    try {
      return JSON.parse(response.match(regex)[1])
    } catch (e) {
      return false
    }
  }

  const newTabID = async (cb?: () => Promise<void>): Promise<void> => {
    log('Creating New Request Parameters...')

    let resp = await httpRequest('https://api.cathaypacific.com/redibe/standardAward/create', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify(newQueryPayload()),
      method: 'POST',
      withCredentials: true
    })

    log('Initial Request Parameters Received')
    const data = await resp.json()
    const parameters = data.parameters
    const urlToPost = data.urlToPost ?? availabilityUrl
    let formData = ''
    for (const key in parameters) {
      formData += `${key}=${parameters[key]}&`
    }

    log('Requesting New Tab ID...')
    resp = await httpRequest(urlToPost, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: formData,
      method: 'POST',
      withCredentials: true
    })
    const text = await resp.text()
    let errorMessage = lang.tab_retrieve_fail

    if (resp.status === 200) {
      log('Tab ID Response Received. Parsing...')
      requestParams = responseParser(text, /requestParams = JSON\.parse\(JSON\.stringify\('([^']+)/)
      log('requestParams:', requestParams)

      if (Object.keys(requestParams).length === 0) {
        const errorBom = responseParser(text, /errorBom = ([^;]+)/)
        if (errorBom?.modelObject?.step === 'Error') {
          errorMessage = errorBom.modelObject?.messages[0]?.subText ?? errorMessage
        }

        log('Tab ID Could not be parsed')
        batchError(`<strong>Error:</strong> ${errorMessage} (<a href='${loginUrl}'>Login</a>) `)
        resetSearch()
        return
      }

      tabId = requestParams.TAB_ID ?? ''
      log('New Tab ID:', tabId)
      batchError()
      formSubmitUrl = `${availabilityUrl}?TAB_ID=${tabId}`
      if (cb != null) await cb()
    } else {
      const errorBom = responseParser(text, /errorBom = ([^;]+)/)
      if (errorBom?.modelObject?.step === 'Error') {
        errorMessage = errorBom.modelObject?.messages[0]?.subText ?? errorMessage
      }

      log('Failed to receive Tab ID')
      resetSearch()
      batchError(`<strong>Error:</strong> ${errorMessage} ( <a href='${loginUrl}'>Login</a> ) `)
    }
  }

  // ============================================================
  // Regular Search
  // ============================================================

  const regularSearch = async (routes: Query[] = [{
    from: 'TPE',
    to: 'TYO',
    date: dateAdd(1)
  }], passengers: Passengers = {
    adults: 1,
    children: 0
  }, cabinClass: CabinClass = 'Y', cont = { batch: false, query: false, saved: false }): Promise<void> => {
    let cxString: string
    if (routes.length === 1) {
      cxString = JSON.stringify(newQueryPayload(routes[0], passengers, cabinClass))
    } else if (routes.length > 0) {
      cxString = JSON.stringify(newMultiPayload(routes, passengers, cabinClass))
    } else {
      return
    }

    // cxString = JSON.stringify(newQueryPayload(uef_from, uef_to, uef_date, uef_adult, uef_child))
    log('cxString:', cxString)
    btnSearch.innerHTML = lang.searching
    btnSearch.classList.add('searching')
    const resp = await httpRequest('https://api.cathaypacific.com/redibe/standardAward/create', {
      headers: { 'Content-Type': 'application/json' },
      data: cxString,
      method: 'POST',
      withCredentials: true
    })

    const data = await resp.json()
    const parameters = data.parameters
    const urlToPost = data.urlToPost ?? availabilityUrl
    log('regularSearch parameters:', parameters)
    const actionUrl = new URL(urlToPost)

    await valueSet('cont', { ...cont, ts: Date.now() })

    // Create a form dynamically
    const form = document.createElement('form')
    form.setAttribute('name', 'regular_search_form')
    form.setAttribute('method', 'post')
    form.setAttribute('action', actionUrl.toString())

    for (const key in parameters) {
      const input = document.createElement('input')
      input.setAttribute('type', 'hidden')
      input.setAttribute('name', key)
      input.setAttribute('value', parameters[key])
      form.appendChild(input)
    }

    document.body.appendChild(form)
    // document.forms.regular_search_form.submit()
    form.submit()
  }

  // ============================================================
  // Bulk Search
  // ============================================================

  let bulkDate = ''

  const bulkSearch = async (singleDate = false): Promise<void> => {
    log('bulkSearch start, remainingDays:', remainingDays)

    let noContinue = false
    if (remainingDays-- === 0) {
      stopBatch()
      noContinue = true
    }

    if (!cont.query) {
      await regularSearch([{
        from: uef.from.substring(0, 3),
        to: uef.to.substring(0, 3),
        date: uef.date
      }], {
        adults: uef.adults,
        children: uef.children
      }, 'Y', { batch: true, query: true, saved: false })
      return
    }

    bulkDate ||= uef.date

    const routes: Route[] = []
    const rtFrom = uef.from.split(',')
    const rtTo = uef.to.split(',')
    const queryCount = rtFrom.length * rtTo.length

    if (!noContinue && remainingDays > Math.ceil(25 / queryCount)) {
      remainingDays = Math.ceil(25 / queryCount) - 1
    }

    rtFrom.forEach((from) => {
      rtTo.forEach((to) => {
        routes.push({ from, to })
      })
    })

    let thisRoute = routes.shift()

    const populateNextRoute = async (pageBom): Promise<void> => {
      insertResults(thisRoute.from, thisRoute.to, bulkDate, pageBom)

      if (routes.length > 0) {
        thisRoute = routes.shift()
        await searchAvailability(thisRoute.from, thisRoute.to, bulkDate, uef.adults, uef.children, populateNextRoute)
      } else {
        bulkDate = dateAdd(1, bulkDate)
        if (singleDate) stopBatch()
        await bulkSearch()
      }
    }

    await searchAvailability(thisRoute.from, thisRoute.to, bulkDate, uef.adults, uef.children, populateNextRoute)
  }

  // ============================================================
  // Search Availability
  // ============================================================

  const searchAvailability = async (from: string, to: string, date: string, adult: number, child: number, cb): Promise<void> => {
    if (stopSearch) {
      stopSearch = false
      searching = false
      return
    }

    searching = true

    // If destination is not valid, abort
    if (!/^[A-Z]{3}$/.test(to)) {
      // eslint-disable-next-line n/no-callback-literal
      await cb({
        modelObject: {
          isContainingErrors: true,
          messages: [{ text: lang.invalid_code }]
        }
      })
      return
    }

    const requests = requestParams
    log('searchAvailability() requests:', requests)

    requests.B_DATE_1 = `${date}0000`
    // requests.B_DATE_2 = `${dateAdd(1, date)}0000`
    requests.B_LOCATION_1 = from
    requests.E_LOCATION_1 = to
    // requests.B_LOCATION_2 = to
    // requests.E_LOCATION_2 = from
    delete requests.ENCT
    delete requests.SERVICE_ID
    delete requests.DIRECT_LOGIN
    delete requests.ENC

    const params = Object.entries(requests).map(([key, value]) => `${key}=${value}`).join('&')

    const resp = await httpRequest(formSubmitUrl, {
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: params,
      method: 'POST',
      withCredentials: true
    })

    const searchAgain = async (): Promise<void> => {
      await searchAvailability(from, to, date, adult, child, cb)
    }

    if (resp.status === 200) {
      batchError()
      let data: { pageBom: string }
      try {
        data = await resp.json()
      } catch {
        // const res = response.responseText
        // const incapsula_script = res.match(/<script src='(\/_Incapsula_[^]+.js)'><\/script>/)
        // if (incapsula_script) batchError('Cathay bot block triggered.')
        batchError('Response not valid JSON')
        return
      }
      const pageBom = JSON.parse(data.pageBom)
      await cb(pageBom)
    } else if (resp.status === 404) {
      batchError(lang.key_exhausted)
      await newTabID(searchAgain)
    } else if (resp.status >= 300) {
      batchError(lang.getting_key)
      await newTabID(searchAgain)
    }
  }

  // ============================================================
  // Insert Search Results
  // ============================================================

  const insertResults = (from: string, to: string, date: string, pageBom): void => {
    if (divTableBody.querySelector(`tr[data-date="${date}"]`) == null) {
      const resultsRow = `
        <tr data-date="${date}">
          <td class="bulkDate">
            <a href="javascript:void(0)" data-book data-date="${date}">${dateStringToDashedDateString(date)}</a>
            ${dateStringToWeekday(date)}
          </td>
          <td class="bulk_flights"></td>
        </tr>
      `
      divTableBody.insertAdjacentHTML('beforeend', resultsRow)
    }

    const heartSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="heart_save" viewBox="0 0 16 16"> <path d="M4 1c2.21 0 4 1.755 4 3.92C8 2.755 9.79 1 12 1s4 1.755 4 3.92c0 3.263-3.234 4.414-7.608 9.608a.513.513 0 0 1-.784 0C3.234 9.334 0 8.183 0 4.92 0 2.755 1.79 1 4 1z"></path></svg>'

    let flightHTML = `
      <div data-from="${from}" data-to="${to}">
        <span class="flight_title">${from} - ${to}
          <a href="javascript:void(0)" class="bulk_save ${savedQueries.has(`${date}${from}${to}`) ? 'bulk_saved' : ''}" data-save data-date="${date}" data-from="${from}" data-dest="${to}">${heartSvg}</a>
          <a href="javascript:void(0)" class="bulk_go_book" data-book data-date="${date}" data-from="${from}" data-dest="${to}">Book &raquo;</a>
        </span>
        <div class="flight_list">`

    if (pageBom.modelObject?.isContainingErrors) {
      flightHTML += `<span class="bulk_response_error"><strong>Error:</strong> ${pageBom.modelObject?.messages[0]?.text}</span>`
    } else {
      const flights = pageBom.modelObject?.availabilities?.upsell?.bounds[0].flights
      flights.forEach((flight) => {
        let available = ''
        // TODO: Maybe use ?? operator instead of ||, but need to account for NaN
        const f1 = +flight.segments[0].cabins?.F?.status || 0
        const j1 = +flight.segments[0].cabins?.B?.status || 0
        const p1 = +flight.segments[0].cabins?.N?.status || 0
        const y1 = (+flight.segments[0].cabins?.E?.status || 0) + (+flight.segments[0].cabins?.R?.status || 0)
        let numF = 0
        let numJ = 0
        let numP = 0
        let numY = 0
        const leg1Airline = flight.segments[0].flightIdentifier.marketingAirline
        const leg1FlightNum = flight.segments[0].flightIdentifier.flightNumber
        const leg1DepTime = getFlightTime(flight.segments[0].flightIdentifier.originDate)
        const leg1ArrTime = getFlightTime(flight.segments[0].destinationDate)
        const leg1Duration = getFlightTime(flight.duration, true)
        let flightKey: string
        if (flight.segments.length === 1) {
          if (f1 >= 1) {
            available += ` <span class='bulk_cabin bulk_f'>F <b>${f1}</b></span>`
            numF = f1
          }
          if (j1 >= 1) {
            available += ` <span class='bulk_cabin bulk_j'>J <b>${j1}</b></span>`
            numJ = j1
          }
          if (p1 >= 1) {
            available += ` <span class='bulk_cabin bulk_p'>PY <b>${p1}</b></span>`
            numP = p1
          }
          if (y1 >= 1) {
            available += ` <span class='bulk_cabin bulk_y'>Y <b>${y1}</b></span>`
            numY = y1
          }
          flightKey = `${date}${from}${to}_${leg1Airline}${leg1FlightNum}`
          if (available !== '') {
            flightHTML += `
              <div class="flight_wrapper">
                <div class="flight_item direct ${savedFlights[flightKey] ? 'saved' : ''}" data-flight-info="${flightKey}" data-flight-avail="${f1}_${j1}_${p1}_${y1}" data-direct="1" data-f="${numF ? 1 : 0}" data-j="${numJ ? 1 : 0}" data-p="${numP ? 1 : 0}" data-y="${numY ? 1 : 0}">
                  <img src="https://book.cathaypacific.com${staticFilesPath}common/skin/img/airlines/logo-${leg1Airline.toLowerCase()}.png">
                  <span class="flight_num">${leg1Airline}${leg1FlightNum}</span>
                  ${available}
                  <span class="chevron">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6.34317 7.75732L4.92896 9.17154L12 16.2426L19.0711 9.17157L17.6569 7.75735L12 13.4142L6.34317 7.75732Z" fill="currentColor"></path>
                    </svg>
                  </span>
                  <span class="flight_save">${heartSvg}</span>
                </div>
                <div class="flight_info">
                  <span class="info_flight">${leg1Airline}${leg1FlightNum}</span>
                  <span class="info_dept"><span>Departs:</span> ${leg1DepTime}</span>
                  <span class="info_arr"><span>Arrives:</span> ${leg1ArrTime}</span>
                  <span class="info_duration"><span>Total Flight Duration:</span> ${leg1Duration}</span>
                </div>
              </div>
            `
          }
          if (savedFlights[flightKey]) {
            savedFlights[flightKey] = {
              F: f1,
              J: j1,
              P: p1,
              Y: y1
            }
            updateSavedFlights()
          }
        } else {
          // TODO: Maybe use ?? operator instead of ||, but need to account for NaN
          const f2 = +flight.segments[1].cabins?.F?.status || 0
          const j2 = +flight.segments[1].cabins?.B?.status || 0
          const p2 = +flight.segments[1].cabins?.N?.status || 0
          const y2 = (+flight.segments[1].cabins?.E?.status || 0) + (+flight.segments[1].cabins?.R?.status || 0)

          if (f1 >= 1 && f2 >= 1) {
            numF = Math.min(f1, f2)
            available += ` <span class='bulk_cabin bulk_f'>F <b>${numF}</b></span>`
          }
          if (j1 >= 1 && j2 >= 1) {
            numJ = Math.min(j1, j2)
            available += ` <span class='bulk_cabin bulk_j'>J <b>${numJ}</b></span>`
          }
          if (p1 >= 1 && p2 >= 1) {
            numP = Math.min(p1, p2)
            available += ` <span class='bulk_cabin bulk_p'>PY <b>${numP}</b></span>`
          }
          if (y1 >= 1 && y2 >= 1) {
            numY = Math.min(y1, y2)
            available += ` <span class='bulk_cabin bulk_y'>Y <b>${numY}</b></span>`
          }
          const leg2Airline = flight.segments[1].flightIdentifier.marketingAirline
          const leg2FlightNum = flight.segments[1].flightIdentifier.flightNumber
          const leg2DepTime = getFlightTime(flight.segments[1].flightIdentifier.originDate)
          const leg2ArrTime = getFlightTime(flight.segments[1].destinationDate)
          const transitTime = getFlightTime(flight.segments[1].flightIdentifier.originDate - flight.segments[0].destinationDate, true)
          const transitAirportCode = /^[A-Z]{3}:([A-Z:]{3,7}):[A-Z]{3}_/g.exec(flight.flightIdString)[1].replace(':', ' / ')
          flightKey = `${date}${from}${to}_${leg1Airline}${leg1FlightNum}_${transitAirportCode}_${leg2Airline}${leg2FlightNum}`
          if (available !== '') {
            flightHTML += `
              <div class="flight_wrapper">
                <div class="flight_item ${savedFlights[flightKey] ? 'saved' : ''}" data-direct="0" data-flight-info="${flightKey}"  data-flight-avail="${numF}_${numJ}_${numP}_${numY}" data-f="${numF ? 1 : 0}" data-j="${numJ ? 1 : 0}" data-p="${numP ? 1 : 0}" data-y="${numY ? 1 : 0}">
                  <img src="https://book.cathaypacific.com${staticFilesPath}common/skin/img/airlines/logo-${leg1Airline.toLowerCase()}.png">
                  <span class="flight_num">${leg1Airline}${leg1FlightNum}
                  <span class="stopover">${transitAirportCode}</span>
                  ${leg2Airline}${leg2FlightNum}</span>
                  ${available}
                  <span class="chevron">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6.34317 7.75732L4.92896 9.17154L12 16.2426L19.0711 9.17157L17.6569 7.75735L12 13.4142L6.34317 7.75732Z" fill="currentColor"></path>
                    </svg>
                  </span>
                  <span class="flight_save">${heartSvg}</span>
                </div>
                <div class="flight_info">
                  <span class="info_flight">${leg1Airline}${leg1FlightNum}</span>
                  <span class="info_dept"><span>Departs:</span> ${leg1DepTime}</span>
                  <span class="info_arr"><span>Arrives:</span> ${leg1ArrTime}</span>
                  <span class="info_transit"><span>Transit Time:</span> ${transitTime}</span>
                  <span class="info_flight">${leg2Airline}${leg2FlightNum}</span>
                  <span class="info_dept"><span>Departs:</span> ${leg2DepTime}</span>
                  <span class="info_arr"><span>Arrives:</span> ${leg2ArrTime}</span>
                  <span class="info_duration"><span>Total Flight Duration:</span> ${leg1Duration}</span>
                </div>
              </div>
            `
          }
          if (savedFlights[flightKey]) {
            savedFlights[flightKey] = {
              F: numF,
              J: numJ,
              P: numP,
              Y: numY
            }
            updateSavedFlights()
          }
        }
      })
    }
    flightHTML += '</div></div>'

    divTableBody.querySelector(`tr[data-date="${date}"] .bulk_flights`).insertAdjacentHTML('beforeend', flightHTML)
    stickyFooter()
  }

  // ============================================================
  // Sticky Footer
  // ============================================================

  const stickyFooter = (): void => {
    const footerOffset = divFooter.getBoundingClientRect()
    const ueformOffset = divUeContainer.getBoundingClientRect()
    if (footerOffset.top < window.innerHeight - 55 || ueformOffset.top + divUeContainer.clientHeight > window.innerHeight - 72) {
      divFooter.classList.remove('bulk_sticky')
    } else {
      divFooter.classList.add('bulk_sticky')
    }
  }

  // ============================================================
  // Initialize
  // ============================================================

  const initSearchBox = async (): Promise<void> => {
    await initCxVars()
    shadowContainer.appendChild(searchBox)
    assignElements()
    addFormListeners()
    window.addEventListener('scroll', (e) => {
      stickyFooter()
    })
    updateSavedCount()
    updateSavedFlights()
    await loadAirports()
    autocomplete(inputFrom, airports)
    autocomplete(inputTo, airports)

    if (cont.query) {
      await resetContVars()
      // If over 5 minutes since cont query, don't auto search
      if (Date.now() - cont.ts > 60 * 5 * 1000) return
      btnBatch.innerHTML = lang.searching_w_cancel
      btnBatch.classList.add('bulkSearching')
      document.body.classList.add('cont_query')
      setTimeout(async () => {
        if (cont.saved) {
          await savedSearch()
        } else {
          await bulkClick(!cont.batch)
        }
      }, 1000)
    }
  }

  await initRoot()
})()
