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

interface QueryPayload {
  awardType: string
  brand: string
  cabinClass: CabinClass
  entryCountry: string
  entryLanguage: string
  entryPoint: string
  errorUrl: string
  returnUrl: string
  isFlexibleDate: boolean
  numAdult: number
  numChild: number
  promotionCode: string
  segments: Array<{
    departureDate: string
    origin: string
    destination: string
  }>
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

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type FlightAvailability = {
  F: number
  J: number
  P: number
  Y: number
}

interface Flight extends Query, FlightAvailability {
  fullQuery: string
  leg1: string
  stop: string
  leg2: string
}

interface Segment {
  departureDate: string
  origin: string
  destination: string
}

interface SavedFlights {
  [key: string]: FlightAvailability
}
