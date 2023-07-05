declare const unsafeWindow: typeof window & {
  formSubmitUrl?: string
  requestParams?: string | object
  staticFilesPath?: string
}

type json =
  | string
  | number
  | boolean
  | null
  | json[]
  | { [key: string]: json }

interface Airports { [key: string]: Airport }

type CabinClass = 'Y' | 'W' | 'C' | 'F'

interface Airport {
  airportCode: string
  countryName: string
  shortName: string
}

interface Passengers {
  adults: number
  children: number
}

interface RequestParams {
  SERVICE_ID?: string
  TAB_ID?: string
  DIRECT_LOGIN?: string
  // B_DATE_2?: string
  // B_LOCATION_2?: string
  B_DATE_1?: string
  B_LOCATION_1?: string
  ENC?: string
  E_LOCATION_1?: string
  // E_LOCATION_2?: string
  ENCT?: string
}

interface Route {
  from: string
  to: string
}

interface Query extends Route {
  date: string
}

interface Flight extends Query {
  fullQuery: string
  leg1: string
  stop: string
  leg2: string
  F: number
  J: number
  P: number
  Y: number
}

interface SavedFlights {
  [key: string]: { 'F': number, 'J': number, 'P': number, 'Y': number }
}
