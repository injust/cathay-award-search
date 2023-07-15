import { lang } from './localization'
import captchaCss from './styles/captcha.css?inline'
import styleCss from './styles/style.css?inline'
import { dateAdd, dateStringToDashedDateString, dateStringToWeekday, getFlightTime, httpRequest, isValidDate, log, queryToSegment, responseParser, valueGet, valueSet, waitForEl } from './utils'

await (async () => {
  'use strict'

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
  const loginUrl = new URL(`https://www.cathaypacific.com/content/cx/${browserLang}_${browserCountry}/sign-in.html`)
  loginUrl.searchParams.set('loginreferrer', `https://www.cathaypacific.com/cx/${browserLang}_${browserCountry}/book-a-trip/redeem-flights/redeem-flight-awards.html`)

  let staticFilesPath: string
  let requestParams: RequestParams
  let tabId: string
  let formSubmitUrl: string
  let loadingIconHtml: string

  const initCxVars = async (): Promise<void> => {
    log('initCxVars()')

    staticFilesPath = await valueGet<string>('static_files_path', '/CathayPacificAwardV3/AML_IT3.3.24/')
    if (unsafeWindow.staticFilesPath != null) {
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

    loadingIconHtml = `<img src='https://book.cathaypacific.com${staticFilesPath}common/skin/img/icons/cx/icon-loading.gif'>`
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
  const savedFlights = new Map(Object.entries(await valueGet<SavedFlights>('saved_flights', {})))
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
  //   ts: urlParams.has('cont_ts') ? +urlParams.get('cont_ts') : 0
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
  // Search Box
  // ============================================================

  const searchBox = document.createElement('div')
  searchBox.innerHTML = `
    <div class="unelevated_form">
      <div class="unelevated_title"><a href="https://www.cathaypacific.com/cx/${browserLang}_${browserCountry}/book-a-trip/redeem-flights/redeem-flight-awards.html">Unelevated Award Search</a></div>

      <div class="login_prompt hidden"><span class="unelevated_error"><a href="${loginUrl.toString()}">${lang.login}</a></span></div>

      <div class="unelevated_faves hidden">
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
          <svg width="16" height="16" fill="currentColor" class="heart_save" viewBox="0 0 16 16">
            <path d="M4 1c2.21 0 4 1.755 4 3.92C8 2.755 9.79 1 12 1s4 1.755 4 3.92c0 3.263-3.234 4.414-7.608 9.608a.513.513 0 0 1-.784 0C3.234 9.334 0 8.183 0 4.92 0 2.755 1.79 1 4 1z"></path>
          </svg>
          <span>0</span>
        </a>
      </div>

      <div class="labels">
        <a href="javascript:void(0);" class="switch">
          <svg height="16px" width="16px" viewBox="0 0 365.352 365.352" xml:space="preserve" stroke-width="0" transform="rotate(180)">
            <g stroke-width="0"></g>
            <path d="M363.155,169.453l-14.143-14.143c-1.407-1.407-3.314-2.197-5.304-2.197 c-1.989,0-3.897,0.79-5.304,2.197l-45.125,45.125v-57.503c0-50.023-40.697-90.721-90.721-90.721H162.3c-4.143,0-7.5,3.358-7.5,7.5 v20c0,4.142,3.357,7.5,7.5,7.5h40.26c30.725,0,55.721,24.996,55.721,55.721v57.503l-45.125-45.125 c-1.407-1.407-3.314-2.197-5.304-2.197c-1.989,0-3.896,0.79-5.304,2.197l-14.143,14.143c-1.406,1.406-2.196,3.314-2.196,5.303 c0,1.989,0.79,3.897,2.196,5.303l82.071,82.071c1.465,1.464,3.385,2.197,5.304,2.197c1.919,0,3.839-0.732,5.304-2.197 l82.071-82.071c1.405-1.406,2.196-3.314,2.196-5.303C365.352,172.767,364.561,170.859,363.155,169.453z"></path>
            <path d="M203.052,278.14h-40.26c-30.725,0-55.721-24.996-55.721-55.721v-57.503l45.125,45.126 c1.407,1.407,3.314,2.197,5.304,2.197c1.989,0,3.896-0.79,5.304-2.197l14.143-14.143c1.406-1.406,2.196-3.314,2.196-5.303 c0-1.989-0.79-3.897-2.196-5.303l-82.071-82.071c-2.93-2.929-7.678-2.929-10.607,0L2.196,185.292C0.79,186.699,0,188.607,0,190.596 c0,1.989,0.79,3.897,2.196,5.303l14.143,14.143c1.407,1.407,3.314,2.197,5.304,2.197s3.897-0.79,5.304-2.197l45.125-45.126v57.503 c0,50.023,40.697,90.721,90.721,90.721h40.26c4.143,0,7.5-3.358,7.5-7.5v-20C210.552,281.498,207.194,278.14,203.052,278.14z"></path>
          </svg>
        </a>
        <label class="labels_left">
          <span>From</span>
          <input tabindex="1" type="text" id="uef_from" name="uef_from" placeholder="TPE,HKG" value="${uef.from}">
          <svg width="16" height="16" fill="currentColor" class="clearFrom" viewBox="0 0 16 16">
            <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"></path>
          </svg>
        </label>
        <label class="labels_right"><span>Adults</span>
        <input tabindex="4" type="number" inputmode="decimal" onFocus="this.select()" id="uef_adult" name="uef_adult" placeholder="Adults" value="${uef.adults}" min="0">
        </label>
        <label class="labels_left">
          <span>To</span>
          <input tabindex="2" type="text" id="uef_to" name="uef_to" placeholder="TYO,LHR,SFO" value="${uef.to}">
          <svg width="16" height="16" fill="currentColor" class="clearTo" viewBox="0 0 16 16">
            <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"></path>
          </svg>
        </label>
        <label class="labels_right"><span>Children</span>
        <input tabindex="5" type="number" inputmode="decimal" onFocus="this.select()" id="uef_child" name="uef_child" placeholder="Children" value="${uef.children}" min="0">
        </label>
        <label class="labels_left"><span>Date</span>
        <input tabindex="3" class="uef_date" onFocus="this.setSelectionRange(6, 8)" id="uef_date" inputmode="decimal" name="uef_date" placeholder="YYYYMMDD" value="${uef.date}">
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
      <input type="number" inputmode="decimal" onFocus="this.select()" id="multi_adult" name="multi_adult" placeholder="Adults" value="1" min="0">
      </label>
      <label class="labels_right"><span>Children</span>
      <input type="number" inputmode="decimal" onFocus="this.select()" id="multi_child" name="multi_child" placeholder="Children" value="0" min="0">
      </label>
      <a href="javascript:void(0)" class="multi_search">${lang.book_multi}</a>
    </div>

    <div class="bulk_box">
      <div class="bulk_results hidden">
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
          <div class="bulk_error hidden"><span></span></div>
        </div>
      </div>
    </div>
    <div id="encbox"></div>
  `

  // ============================================================
  // Styles
  // ============================================================

  // Append CSS to DOM Element (Default to Shadow Root)
  const addCss = (css: string, target: Node = shadowRoot): void => {
    const styleSheet = document.createElement('style')
    styleSheet.innerHTML = css
    target.appendChild(styleSheet)
  }

  addCss(styleCss)
  addCss(captchaCss, document.body)

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
        uef.adults = +inputAdult.value
        uef.children = +inputChild.value
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
        if (el.value.length > 0) el.value += ','
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
          } else {
            el.classList.add('bulk_saved')
            savedQueries.add(key)
          }

          updateSavedCount()
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
          const flightAvail = flightItem.dataset.flightAvail.split('_')
          const flightKey = flightItem.dataset.flightInfo

          if (flightItem.classList.contains('saved')) {
            flightItem.classList.remove('saved')
            savedFlights.delete(flightKey)
          } else {
            flightItem.classList.add('saved')
            savedFlights.set(flightKey, {
              F: +flightAvail[0], J: +flightAvail[1], P: +flightAvail[2], Y: +flightAvail[3]
            })
          }

          updateSavedFlights()
          await valueSet('saved_flights', Object.fromEntries(savedFlights))
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
          savedQueries.delete(el.dataset.remove)
          updateSavedCount()
          await valueSet('saved_queries', Array.from(savedQueries))

          savedFlights.delete(el.dataset.remove)
          updateSavedFlights()
          await valueSet('saved_flights', Object.fromEntries(savedFlights))
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
        if (selectedSegments.length === 0) {
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
        if (savedQueries.size === 0) {
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
        if (selectedSegments.length === 0) {
          alert('No Selected Segments')
          return
        }

        linkSearchMulti.innerText = lang.loading
        const toSearch: Query[] = []
        Array.from(selectedSegments).sort((a, b) => +a.dataset.segment - +b.dataset.segment).forEach((segment) => {
          toSearch.push({
            date: segment.dataset.date,
            from: segment.dataset.route.substring(0, 3),
            to: segment.dataset.route.substring(3, 6)
          })
        })
        await regularSearch(toSearch, {
          adults: +inputMultiAdult.value,
          children: +inputMultiChild.value
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
      divSaved.classList.toggle('hidden')
    })
  }

  // ============================================================
  // Data Retrievers
  // ============================================================

  const airports: Airports = {}

  const loadAirports = async (): Promise<void> => {
    log('loadAirports()')

    const resp = await httpRequest(`https://api.cathaypacific.com/redibe/airport/origin/${browserLang}_${browserCountry}/`)

    const data: AirportResponse = JSON.parse((await resp.text()).replace('Taiwan China', 'Taiwan'))
    if (data.airports !== null) {
      data.airports.forEach(({ airportCode, countryName, shortName }) => {
        airports[airportCode] = { airportCode, countryName, shortName }
      })
    }
  }

  // ============================================================
  // UI Logic
  // ============================================================

  const batchError = (label?: string): void => {
    if (label == null) {
      divError.classList.add('hidden')
    } else {
      shadowRoot.querySelector('.bulk_error span').innerHTML = label
      divError.classList.remove('hidden')
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
          if (divMatches.length > 0) divMatches[currentFocus].click()
        } else if (divMatches.length > 0) {
          divContainer.querySelector<HTMLDivElement>(':not').click()
        }
      } else if (['Tab', ' '].includes(e.key)) {
        closeAllLists()
        // Simulate a click on the first item
        if (divMatches.length > 0) divMatches[0].click()
      }
    })

    // Classify an item as "active"
    const setActive = (divMatches: HTMLCollectionOf<HTMLDivElement>): void => {
      if (divMatches.length === 0) return
      // Start by removing the "active" class on all items
      removeActive(divMatches)

      if (currentFocus >= divMatches.length) {
        currentFocus = 0
      } else if (currentFocus < 0) {
        currentFocus = divMatches.length - 1
      }

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

      if (!/[^,]+$/.test(el.value)) return
      const val = el.value.match(/[^,]+$/)[0]

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
        if (val.toUpperCase() === airportCode.substring(0, val.length).toUpperCase() || val.toUpperCase() === countryName.substring(0, val.length).toUpperCase() || val.toUpperCase() === shortName.substring(0, val.length).toUpperCase()) {
          const sa = airportCode.substring(0, val.length).toUpperCase() === val.toUpperCase() ? val.length : 0
          const se = shortName.substring(0, val.length).toUpperCase() === val.toUpperCase() ? val.length : 0
          const sc = countryName.substring(0, val.length).toUpperCase() === val.toUpperCase() ? val.length : 0
          // Create a DIV element for each matching element
          const divMatch = document.createElement('div')
          // Make the matching letters bold
          let c = `<span class='sa_code'><strong>${airportCode.substring(0, sa)}</strong>${airportCode.substring(sa)}</span>`
          c += `<span class='sc_code'><strong>${shortName.substring(0, se)}</strong>${shortName.substring(se)}`
          c += ` - <strong>${countryName.substring(0, sc)}</strong>${countryName.substring(sc)}</span>`
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
    uef.adults = +inputAdult.value
    uef.children = +inputChild.value
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

    divResults.classList.remove('hidden')
    btnBatch.innerHTML = `${loadingIconHtml} ${lang.searching_w_cancel}`
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
    toSearch.sort((a, b) => +a.date - +b.date)

    let ssQuery = toSearch.shift()

    divResults.classList.remove('hidden')
    btnBatch.innerHTML = `${loadingIconHtml} ${lang.searching_w_cancel}`
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

    const populateNextQuery = async (pageBom: PageBom): Promise<void> => {
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
    savedArr.sort((a, b) => +a.date - +b.date)

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
            <svg width="16" height="16" fill="currentColor" class="saved_delete" viewBox="0 0 16 16">
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
    savedFlights.forEach((availability, query) => {
      const savedDate = new Date(+query.substring(0, 4), +query.substring(4, 6) - 1, +query.substring(6, 8))
      const today = new Date()
      if (savedDate <= today) {
        savedFlights.delete(query)
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
        F: availability.F,
        J: availability.J,
        P: availability.P,
        Y: availability.Y
      })
    })
    savedArr.sort((a, b) => +a.date - +b.date)

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
            <span class="sf_route">${from}-${stop !== '' ? `${stop}-` : ''}${to}</span>
            <span class="sf_flights">
              ${leg1}${leg2 !== '' ? ` + ${leg2}` : ''}
              <span class="sf_avail">
                ${avail.F > 0 ? `<span class="av_f">F ${avail.F}</span>` : ''}
                ${avail.J > 0 ? `<span class="av_j">J ${avail.J}</span>` : ''}
                ${avail.P > 0 ? `<span class="av_p">PY ${avail.P}</span>` : ''}
                ${avail.Y > 0 ? `<span class="av_y">Y ${avail.Y}</span>` : ''}
              </span>
            </span>
          </span>
          </label>
          <a href="javascript:void(0);" class="saved_book" data-book "data-date="${date}" data-from="${from}" data-dest="${to}">${lang.query} &raquo;</a>
          <span class="leg"></span>
          <a href="javascript:void(0);" class="saved_remove" data-remove="${fullQuery}">
            <svg width="16" height="16" fill="currentColor" class="saved_delete" viewBox="0 0 16 16">
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
      if (airportCode !== '') errorAirportCodes.push(airportCode)
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
    const data: Profile = await resp.json()
    if (data.membershipNumber === null) divLoginPrompt.classList.remove('hidden')
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
  }, cabinClass: CabinClass = 'Y'): QueryPayload => {
    log('newQueryPayload()')

    return {
      awardType: 'Standard',
      brand: 'CX',
      cabinClass,
      entryCountry: browserCountry,
      entryLanguage: browserLang,
      entryPoint: `https://www.cathaypacific.com/cx/${browserLang}_${browserCountry}/book-a-trip/redeem-flights/redeem-flight-awards.html`,
      errorUrl: `https://www.cathaypacific.com/cx/${browserLang}_${browserCountry}/book-a-trip/redeem-flights/redeem-flight-awards.html?recent_search=ow`,
      returnUrl: `https://www.cathaypacific.com/cx/${browserLang}_${browserCountry}/book-a-trip/redeem-flights/redeem-flight-awards.html?recent_search=ow`,
      isFlexibleDate: false,
      numAdult: passengers.adults,
      numChild: passengers.children,
      promotionCode: '',
      segments: [queryToSegment(route)]
    }
  }

  const newMultiPayload = (routes: Query[], passengers: Passengers, cabinClass: CabinClass = 'Y'): QueryPayload => {
    log('newMultiPayload()')

    return {
      awardType: 'Standard',
      brand: 'CX',
      cabinClass,
      entryCountry: browserCountry,
      entryLanguage: browserLang,
      entryPoint: `https://www.cathaypacific.com/cx/${browserLang}_${browserCountry}/book-a-trip/redeem-flights/redeem-flight-awards.html`,
      errorUrl: `https://www.cathaypacific.com/cx/${browserLang}_${browserCountry}/book-a-trip/redeem-flights/redeem-flight-awards.html?recent_search=mc`,
      returnUrl: `https://www.cathaypacific.com/cx/${browserLang}_${browserCountry}/book-a-trip/redeem-flights/redeem-flight-awards.html?recent_search=mc`,
      isFlexibleDate: false,
      numAdult: passengers.adults,
      numChild: passengers.children,
      promotionCode: '',
      segments: routes.map(queryToSegment)
    }
  }

  // ============================================================
  // Get New TAB_ID
  // ============================================================

  const newTabID = async (cb?: () => Promise<void>): Promise<void> => {
    log('Creating New Request Parameters...')

    let resp = await httpRequest('https://api.cathaypacific.com/redibe/standardAward/create', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify(newQueryPayload()),
      method: 'POST',
      withCredentials: true
    })

    log('Initial Request Parameters Received')
    const data: QueryResponse = await resp.json()
    let formData = ''
    for (const key in data.parameters) {
      formData += `${key}=${data.parameters[key]}&`
    }

    log('Requesting New Tab ID...')
    resp = await httpRequest(data.urlToPost ?? availabilityUrl, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: formData,
      method: 'POST',
      withCredentials: true
    })
    const text = await resp.text()
    let errorMessage = lang.tab_retrieve_fail

    if (resp.status === 200) {
      log('Tab ID Response Received. Parsing...')
      requestParams = responseParser<RequestParams>(text, /requestParams = JSON\.parse\(JSON\.stringify\('([^']+)/)
      log('requestParams:', requestParams)

      if (Object.keys(requestParams).length === 0) {
        const errorBom = responseParser<PageBom>(text, /errorBom = ([^;]+)/)
        if (errorBom?.modelObject?.step === 'Error') {
          errorMessage = errorBom.modelObject?.messages[0]?.subText ?? errorMessage
        }

        log('Tab ID Could not be parsed')
        batchError(`<strong>Error:</strong> ${errorMessage} (<a href='${loginUrl.toString()}'>Login</a>) `)
        resetSearch()
        return
      }

      tabId = requestParams.TAB_ID ?? ''
      log('New Tab ID:', tabId)
      batchError()
      formSubmitUrl = `${availabilityUrl}?TAB_ID=${tabId}`
      if (cb != null) await cb()
    } else {
      const errorBom = responseParser<PageBom>(text, /errorBom = ([^;]+)/)
      if (errorBom?.modelObject?.step === 'Error') {
        errorMessage = errorBom.modelObject?.messages[0]?.subText ?? errorMessage
      }

      log('Failed to receive Tab ID')
      resetSearch()
      batchError(`<strong>Error:</strong> ${errorMessage} ( <a href='${loginUrl.toString()}'>Login</a> ) `)
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
    let cxString: QueryPayload
    if (routes.length === 1) {
      cxString = newQueryPayload(routes[0], passengers, cabinClass)
    } else if (routes.length > 0) {
      cxString = newMultiPayload(routes, passengers, cabinClass)
    } else {
      return
    }

    // cxString = newQueryPayload(uef_from, uef_to, uef_date, uef_adult, uef_child)
    log('cxString:', cxString)
    btnSearch.innerHTML = `${loadingIconHtml} ${lang.searching_cont}`
    btnSearch.classList.add('searching')
    const resp = await httpRequest('https://api.cathaypacific.com/redibe/standardAward/create', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify(cxString),
      method: 'POST',
      withCredentials: true
    })

    const data: QueryResponse = await resp.json()
    log('regularSearch parameters:', data.parameters)

    await valueSet('cont', { ...cont, ts: Date.now() })

    // Create a form dynamically
    const form = document.createElement('form')
    form.setAttribute('name', 'regular_search_form')
    form.setAttribute('method', 'post')
    form.setAttribute('action', data.urlToPost ?? availabilityUrl)

    for (const key in data.parameters) {
      const input = document.createElement('input')
      input.setAttribute('type', 'hidden')
      input.setAttribute('name', key)
      input.setAttribute('value', data.parameters[key])
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

    const populateNextRoute = async (pageBom: PageBom): Promise<void> => {
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

  const searchAvailability = async (from: string, to: string, date: string, adult: number, child: number, cb: (pageBom: PageBom) => Promise<void>): Promise<void> => {
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
          messages: [{ text: lang.invalid_code }],
          step: 'Error',
          isContainingErrors: true
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
      const pageBom: PageBom = JSON.parse(data.pageBom)
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

  const insertResults = (from: string, to: string, date: string, pageBom: PageBom): void => {
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

    const heartSvg = '<svg width="16" height="16" fill="currentColor" class="heart_save" viewBox="0 0 16 16"> <path d="M4 1c2.21 0 4 1.755 4 3.92C8 2.755 9.79 1 12 1s4 1.755 4 3.92c0 3.263-3.234 4.414-7.608 9.608a.513.513 0 0 1-.784 0C3.234 9.334 0 8.183 0 4.92 0 2.755 1.79 1 4 1z"></path></svg>'

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
        void (async () => {
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
          const leg1Origin = flight.segments[0].originLocation
          const leg1Dest = flight.segments[0].destinationLocation
          let flightKey: string

          if (flight.segments.length === 1) {
            if (f1 > 0) {
              numF = f1
              available += ` <span class='bulk_cabin bulk_f'>F <b>${numF}</b></span>`
            }
            if (j1 > 0) {
              numJ = j1
              available += ` <span class='bulk_cabin bulk_j'>J <b>${numJ}</b></span>`
            }
            if (p1 > 0) {
              numP = p1
              available += ` <span class='bulk_cabin bulk_p'>PY <b>${numP}</b></span>`
            }
            if (y1 > 0) {
              numY = y1
              available += ` <span class='bulk_cabin bulk_y'>Y <b>${numY}</b></span>`
            }

            flightKey = `${date}${from}${to}_${leg1Airline}${leg1FlightNum}`

            if (available !== '') {
              flightHTML += `
              <div class="flight_wrapper">
                <div class="flight_item direct ${savedFlights.has(flightKey) ? 'saved' : ''}" data-flight-info="${flightKey}" data-flight-avail="${numF}_${numJ}_${numP}_${numY}" ${numF > 0 ? 'data-f' : ''} ${numJ > 0 ? 'data-j' : ''} ${numP > 0 ? 'data-p' : ''} ${numY > 0 ? 'data-y' : ''}>
                  <img src="https://book.cathaypacific.com${staticFilesPath}common/skin/img/airlines/logo-${leg1Airline.toLowerCase()}.png">
                  <span class="flight_num">${leg1Airline}${leg1FlightNum}</span>
                  ${available}
                  <span class="chevron">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M6.34317 7.75732L4.92896 9.17154L12 16.2426L19.0711 9.17157L17.6569 7.75735L12 13.4142L6.34317 7.75732Z" fill="currentColor"></path>
                    </svg>
                  </span>
                  <span class="flight_save">${heartSvg}</span>
                </div>
                <div class="flight_info">
                  <span class="info_flight">${leg1Airline}${leg1FlightNum} (${leg1Origin.slice(-3)} ✈ ${leg1Dest.slice(-3)})</span>
                  <span class="info_dept"><span>Departs:</span> ${leg1DepTime}</span>
                  <span class="info_arr"><span>Arrives:</span> ${leg1ArrTime}</span>
                  <span class="info_duration"><span>Total Flight Duration:</span> ${leg1Duration}</span>
                </div>
              </div>
            `
            }
          } else {
            // TODO: Maybe use ?? operator instead of ||, but need to account for NaN
            const f2 = +flight.segments[1].cabins?.F?.status || 0
            const j2 = +flight.segments[1].cabins?.B?.status || 0
            const p2 = +flight.segments[1].cabins?.N?.status || 0
            const y2 = (+flight.segments[1].cabins?.E?.status || 0) + (+flight.segments[1].cabins?.R?.status || 0)

            if (f1 > 0 && f2 > 0) {
              numF = Math.min(f1, f2)
              available += ` <span class='bulk_cabin bulk_f'>F <b>${numF}</b></span>`
            }
            if (j1 > 0 && j2 > 0) {
              numJ = Math.min(j1, j2)
              available += ` <span class='bulk_cabin bulk_j'>J <b>${numJ}</b></span>`
            }
            if (p1 > 0 && p2 > 0) {
              numP = Math.min(p1, p2)
              available += ` <span class='bulk_cabin bulk_p'>PY <b>${numP}</b></span>`
            }
            if (y1 > 0 && y2 > 0) {
              numY = Math.min(y1, y2)
              available += ` <span class='bulk_cabin bulk_y'>Y <b>${numY}</b></span>`
            }

            const leg2Airline = flight.segments[1].flightIdentifier.marketingAirline
            const leg2FlightNum = flight.segments[1].flightIdentifier.flightNumber
            const leg2DepTime = getFlightTime(flight.segments[1].flightIdentifier.originDate)
            const leg2ArrTime = getFlightTime(flight.segments[1].destinationDate)
            const leg2Origin = flight.segments[1].originLocation
            const leg2Dest = flight.segments[1].destinationLocation
            const transitTime = getFlightTime(flight.segments[1].flightIdentifier.originDate - flight.segments[0].destinationDate, true)
            const transitAirportCode = /^[A-Z]{3}:([A-Z:]{3,7}):[A-Z]{3}_/g.exec(flight.flightIdString)[1].replace(':', ' / ')
            flightKey = `${date}${from}${to}_${leg1Airline}${leg1FlightNum}_${transitAirportCode}_${leg2Airline}${leg2FlightNum}`

            if (available !== '') {
              flightHTML += `
              <div class="flight_wrapper">
                <div class="flight_item ${savedFlights.has(flightKey) ? 'saved' : ''}" data-flight-info="${flightKey}" data-flight-avail="${numF}_${numJ}_${numP}_${numY}" ${numF > 0 ? 'data-f' : ''} ${numJ > 0 ? 'data-j' : ''} ${numP > 0 ? 'data-p' : ''} ${numY > 0 ? 'data-y' : ''}>
                  <img src="https://book.cathaypacific.com${staticFilesPath}common/skin/img/airlines/logo-${leg1Airline.toLowerCase()}.png">
                  <span class="flight_num">${leg1Airline}${leg1FlightNum}
                  <span class="stopover">${transitAirportCode}</span>
                  ${leg2Airline}${leg2FlightNum}</span>
                  ${available}
                  <span class="chevron">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M6.34317 7.75732L4.92896 9.17154L12 16.2426L19.0711 9.17157L17.6569 7.75735L12 13.4142L6.34317 7.75732Z" fill="currentColor"></path>
                    </svg>
                  </span>
                  <span class="flight_save">${heartSvg}</span>
                </div>
                <div class="flight_info">
                  <span class="info_flight">${leg1Airline}${leg1FlightNum} (${leg1Origin.slice(-3)} ✈ ${leg1Dest.slice(-3)})</span>
                  <span class="info_dept"><span>Departs:</span> ${leg1DepTime}</span>
                  <span class="info_arr"><span>Arrives:</span> ${leg1ArrTime}</span>
                  <span class="info_transit"><span>Transit Time:</span> ${transitTime}</span>
                  <span class="info_flight">${leg2Airline}${leg2FlightNum} (${leg2Origin.slice(-3)} ✈ ${leg2Dest.slice(-3)})</span>
                  <span class="info_dept"><span>Departs:</span> ${leg2DepTime}</span>
                  <span class="info_arr"><span>Arrives:</span> ${leg2ArrTime}</span>
                  <span class="info_duration"><span>Total Flight Duration:</span> ${leg1Duration}</span>
                </div>
              </div>
            `
            }
          }

          if (savedFlights.has(flightKey)) {
            savedFlights.set(flightKey, { F: numF, J: numJ, P: numP, Y: numY })
            updateSavedFlights()
            await valueSet('saved_flights', Object.fromEntries(savedFlights))
          }
        })()
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
      btnBatch.innerHTML = `${loadingIconHtml} ${lang.searching_w_cancel}`
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
