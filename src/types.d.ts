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

interface RequestParams {
    CHECKSUM?: string,
    CABIN?: string,
    USER_ID?: string,
    TITLE_1?: string,
    SO_SITE_SPEC_SERV_CHARGEABLE?: string,
    CONTACT_POINT_HOME_PHONE_AC?: string,
    WDS_OWPARTNER_LIST?: string,
    TRIP_FLOW?: string,
    SO_SITE_ETKT_Q_AND_CAT?: string,
    FROM_SITE?: string,
    SERVICE_ID?: string,
    ENABLE_MAIL?: string,
    WDS_CREDITCARD_LIST?: string,
    PREF_AIR_FREQ_NUMBER_1_1?: string,
    MILES_PACKAGE_PEY?: string,
    WDS_IS_PROMOTION_ACTIVATED?: string,
    LANGUAGE?: string,
    DISPLAY_USER_NAME?: string,
    SO_SITE_AUTHORIZE_WL_PENDING?: string,
    MARKET?: string,
    ENTRYCOUNTRY?: string,
    SELECTED_CABIN?: string,
    DDS_SCA_URL?: string,
    TAB_ID?: string,
    TRIP_TYPE?: string,
    USER_TYPE?: string,
    SO_SITE_OFFICE_ID?: string,
    DIRECT_NON_STOP?: string,
    SO_SITE_IS_INSURANCE_ENABLED?: string,
    DDS_CNM?: string,
    DIRECT_LOGIN?: string,
    B_DATE_2?: string,
    PREF_AIR_FREQ_NUMBER?: string,
    B_LOCATION_2?: string,
    B_DATE_1?: string,
    B_LOCATION_1?: string,
    PREF_AIR_FREQ_AIRLINE_1_1?: string,
    EMBEDDED_TRANSACTION?: string,
    TOP100?: string,
    LAST_NAME?: string,
    B_ANY_TIME_1?: string,
    B_ANY_TIME_2?: string,
    WDS_FFP_LIST?: string,
    SO_SITE_PREFERRED_CARRIER?: string,
    SKIN?: string,
    SITE?: string,
    PASSWORD_2?: string,
    MILES_PACKAGE_ECO?: string,
    PASSWORD_1?: string,
    PREF_AIR_FREQ_MILES_1_1?: string,
    WDS_PEY_STATUS?: string,
    SO_SITE_QUEUE_CATEGORY?: string,
    WDS_RED_DOMAIN?: string,
    CONTACT_POINT_MOBILE_1_OC?: string,
    MILES_PACKAGE_BUS?: string,
    CONTACT_POINT_HOME_PHONE?: string,
    WDS_IS_TRP_ENABLED?: string,
    DDS_ENABLE_CHATBOT?: string,
    TRAVELLER_TYPE_1?: string,
    BOOKING_FLOW?: string,
    WDS_MOD_DESC_ETCKT?: string,
    CONTACT_POINT_EMAIL_1?: string,
    SO_SITE_QUEUE_OFFICE_ID?: string,
    MILES_NUMBER?: string,
    TIME_STAMP?: string,
    D_ADDRESS2?: string,
    D_ADDRESS1?: string,
    D_ADDRESS3?: string,
    DDS_FROM_PROMO?: string,
    COUNTRY?: string,
    WDS_METHODS_OF_PAYMENT?: string,
    WDS_TIERS_LIST?: string,
    EXTERNAL_ID?: string,
    FXMP_LIST?: string,
    LAST_NAME_1?: string,
    SO_SITE_WL_MORE_PAX_VS_SEAT?: string,
    CSE_ENABLE?: string,
    REDEMPTION_AVAILABILITY?: string,
    ARRANGE_BY?: string,
    FIRST_NAME_1?: string,
    PREF_AIR_FREQ_AIRLINE?: string,
    PAYMENT_TYPE?: string,
    USER_HASH_ID?: string,
    SO_SITE_CHARGEABLE_SEATMAP?: string,
    TIER_STATUS?: string,
    RBD_1_1?: string,
    SO_SITE_ETKT_Q_OFFICE_ID?: string,
    D_ZIPCODE?: string,
    PREF_AIR_MEAL_1_0?: string,
    CONTACT_POINT_MOBILE_1?: string,
    WDS_IS_FXMP_ENABLED?: string,
    ERRORURL?: string,
    ENC?: string,
    WDS_METHODS_OF_DELIVERY?: string,
    CONTACT_POINT_HOME_PHONE_OC?: string,
    WDS_CC_DISCLAIMER?: string,
    RETURNURL?: string,
    IS_SEARCH_BY_MILES?: string,
    FIRST_NAME?: string,
    SO_SITE_BOOK_ON_WAITLIST?: string,
    D_COUNTRY?: string,
    MILES_PACKAGE_FIR?: string,
    D_CITY?: string,
    ENTRYPOINT?: string,
    WDS_ARE_TIERS_ACTIVATED?: string,
    ENTRYLANGUAGE?: string,
    RBD_2_1?: string,
    E_LOCATION_1?: string,
    E_LOCATION_2?: string,
    WDS_URL_CATHAY?: string,
    YOUR_ACCOUNT_LINK?: string,
    ENCT?: string,
    SO_SITE_NB_FLIGHTS_AVAIL?: string,
    TITLE?: string
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
