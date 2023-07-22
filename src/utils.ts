import { GM } from 'vite-plugin-monkey/dist/client'

// ============================================================
// Logging
// ============================================================

export const log = console.debug

// ============================================================
// Greasymonkey Function Wrappers
// ============================================================

// Get and Set Stored Values
export const valueGet: <T extends json>(key: string, defaultValue?: T) => Promise<T> = GM.getValue

export const valueSet = async <T extends json>(key: string, value: T): Promise<T> => {
  await GM.setValue(key, value)
  return value
}

// ============================================================
// XMLHttpRequest
// ============================================================

export const httpRequest = async (url: string | URL, request?: {
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
// Helper Functions
// ============================================================

// Wait for Element to Load
export const waitForEl = async <E extends Element>(selectors: string): Promise<E | null> => await new Promise((resolve) => {
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
export const isValidDate = (dateString: string): boolean => {
  if (!/^\d{8}$/.test(dateString)) return false
  const date = dateStringToDate(dateString)
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  if (year < 1000 || year > 3000 || month === 0 || month > 12) return false
  const monthLength = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (year % 400 === 0 || (year % 100 !== 0 && year % 4 === 0)) monthLength[1] = 29
  if (day <= 0 || day > monthLength[month - 1]) return false
  const today = new Date()
  if ((date.getTime() - today.getTime()) / 24 / 60 / 60 / 1000 >= 366 || (date.getTime() - today.getTime()) / 24 / 60 / 60 / 1000 < -1) return false
  return true
}

// Add to Date and Return CX Date String
export const dateAdd = (days = 0, dateString?: string): string => {
  const newDate = dateString == null ? new Date() : dateStringToDate(dateString)
  newDate.setDate(newDate.getDate() + days)
  return dateToDateString(newDate)
}

// Convert CX Date String to Dashed Date String
export const dateStringToDashedDateString = (dateString: string): string => `${dateString.substring(0, 4).toString()}-${dateString.substring(4, 6).toString().padStart(2, '0')}-${dateString.substring(6, 8).toString().padStart(2, '0')}`

// Get Weekday from CX Date String
export const dateToWeekday = (date: Date): string => {
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return weekdays[date.getDay()]
}

// Get Time
export const getFlightTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  return `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}-${date.getUTCDate().toString().padStart(2, '0')} ${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}`
}

export const getFlightDuration = (timestamp: number): string => {
  const date = new Date(timestamp)
  const hours = (date.getUTCDate() - 1) * 24 + date.getUTCHours()
  return `${(hours > 0 ? `${hours.toString()}hr ` : '') + date.getUTCMinutes().toString()}min`
}

export const dateStringToDate = (dateString: string): Date => new Date(+dateString.substring(0, 4), +dateString.substring(4, 6) - 1, +dateString.substring(6, 8))

export const dateToDateString = (date: Date): string => `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`

export const queryStringToQuery = (query: string): Query => ({
  date: query.substring(0, 8),
  from: query.substring(8, 11),
  to: query.substring(11, 14)
})

export const queryToSegment = (query: Query): Segment => ({
  departureDate: query.date,
  origin: query.from,
  destination: query.to
})

export const parseCabinStatus = (status?: string): number => {
  if (status == null) return 0
  const num = +status
  return isNaN(num) ? 0 : num
}

export const parseResponse = <T extends json>(response: string, regex: RegExp): T => {
  try {
    return JSON.parse(response.match(regex)[1])
  } catch (e) {
    return null
  }
}
