import { lang } from './localization.ts'
import { Query, json } from './types.ts'
import dayjs from 'dayjs'
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
  observer.observe(document.body, { childList: true, subtree: true })
})

export const isValidCxDate = (dateString: string): boolean => {
  const date = dayjs(dateString, undefined, true)
  const now = dayjs()

  if (!date.isValid()) {
    alert(lang.invalid_date)
    return false
  } else if (date.isAfter(now.add(361, 'd'), 'd')) {
    alert(lang.date_too_late)
    return false
  } else if (date.isBefore(now.subtract(1, 'd'), 'd')) {
    alert(lang.date_too_early)
    return false
  }

  return true
}

// @ts-expect-error
export const formatFlightTime = (timestamp: number): string => dayjs.utc(timestamp).format('YYYY-MM-DD HH:mm')

export const formatFlightDuration = (timestamp: number): string => {
  const date = new Date(timestamp)
  const hours = (date.getUTCDate() - 1) * 24 + date.getUTCHours()
  return `${(hours > 0 ? `${hours.toString()}hr ` : '') + date.getUTCMinutes().toString()}min`
}

export const queryStringToQuery = (query: string): Query => ({
  date: dayjs(query.substring(0, 8)),
  from: query.substring(8, 11),
  to: query.substring(11, 14)
})

export const queryToQueryString = (query: Query): string => `${query.date.format('YYYYMMDD')}${query.from}${query.to}`

export const parseCabinStatus = (status?: string): number => {
  if (status == null) return 0
  const num = +status
  return isNaN(num) ? 0 : num
}
