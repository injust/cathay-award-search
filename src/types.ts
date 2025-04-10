import type { Dayjs } from 'dayjs'

declare global {
    interface Window {
        formSubmitUrl?: string
        requestParams?: string | object
        staticFilesPath?: string
    }
}

export interface Airport {
    airportCode: string
    countryName: string
    shortName: string
}

export interface Airports {
    [key: string]: Airport
}

export interface AirportResponse {
    airports: Airport[] | null
}

export interface AvailabilityResponse {
    pageBom: string
    requestParams: string
}

export type CabinClass = 'Y' | 'W' | 'C' | 'F'

export interface Filters {
    nonstop: boolean
    first: boolean
    business: boolean
    premium: boolean
    economy: boolean
}

export interface Passengers {
    adults: number
    children: number
}

export interface PageBom {
    modelObject: {
        messages?: Array<{ text: string }>
        availabilities?: {
            upsell: {
                bounds: Array<{
                    flights: PageBomFlight[]
                }>
            }
        }
        isContainingErrors: boolean
    }
}

export interface PageBomFlight {
    duration: number
    segments: Array<{
        originLocation: string
        destinationLocation: string
        destinationDate: number
        flightIdentifier: {
            marketingAirline: string
            flightNumber: string
            originDate: number
        }
        cabins: {
            F?: { status: string }
            B?: { status: string }
            N?: { status: string }
            E?: { status: string }
            R?: { status: string }
        }
    }>
    flightIdString: string
}

export interface Profile {
    membershipNumber: string | null
}

export interface QueryPayload {
    ACTION: string
    ENTRYPOINT: string
    ENTRYLANGUAGE: string
    ENTRYCOUNTRY: string
    RETURNURL: string
    ERRORURL: string
    CABINCLASS: string
    BRAND: string
    ADULT: number
    CHILD: number
    FLEXIBLEDATE: boolean
    LOGINURL: string
}

export interface QueryResponse {
    parameters?: { [key: string]: string }
    urlToPost?: string
}

export interface RequestParams {
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

export interface Route {
    from: string
    to: string
}

export interface Query extends Route {
    date: Dayjs
}

export interface FlightAvailability {
    F: number
    J: number
    PY: number
    Y: number
}

export interface Flight extends Query, FlightAvailability {
    flightKey: string
    leg1: string
    stop: string
    leg2: string
}

export interface SavedFlights {
    [key: string]: FlightAvailability
}

export interface Uef extends Passengers {
    from: string[]
    to: string[]
    date: string
}
