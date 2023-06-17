declare function GM_getValue<T extends json>(key: string, defaultValue?: T): T
declare function GM_setValue<T extends json>(key: string, value: T): T

type json =
    | string
    | number
    | boolean
    | null
    | json[]
    | { [key: string]: json }

type CabinClass = 'Y' | 'W' | 'C' | 'F'

interface Passengers {
    adults: number,
    children: number
}

interface Route {
    from: string,
    to: string
}

interface Query extends Route {
    date: string
}

interface SavedFlights {
    [key: string]: { 'F': number, 'J': number, 'P': number, 'Y': number }
}
