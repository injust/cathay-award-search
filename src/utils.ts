import { Query, json } from './types'
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

// Check CX Date String Validity (dateString YYYYMMDD)
export const isValidDate = (dateString: string): boolean => {
  if (!/^\d{8}$/.test(dateString)) return false
  const date = dayjs(dateString).toDate()
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  if (year < 1000 || year > 3000 || month === 0 || month > 12) return false
  const monthLength = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (year % 400 === 0 || (year % 100 !== 0 && year % 4 === 0)) monthLength[1] = 29
  if (day <= 0 || day > monthLength[month - 1]) return false
  const now = new Date()
  if ((date.getTime() - now.getTime()) / 24 / 60 / 60 / 1000 >= 366 || (date.getTime() - now.getTime()) / 24 / 60 / 60 / 1000 < -1) return false
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
