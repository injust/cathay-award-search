import classNames from 'classnames'
import dayjs from 'dayjs'
import type { JSX } from 'preact'

import { Heart, Swap } from './Icons.tsx'
import { SavedFlights } from './SavedFlights.tsx'
import { SavedQueries } from './SavedQueries.tsx'
import { lang } from '../localization.ts'
import type { Filters, FlightAvailability, Uef } from '../types.js'

interface SearchBoxProps {
    browserLang: string
    browserCountry: string
    loginUrl: string
    savedFilters: Filters
    savedFlights: Map<string, FlightAvailability>
    savedQueries: Set<string>
    uef: Uef
}

export const SearchBox = ({
    browserLang,
    browserCountry,
    loginUrl,
    savedFilters,
    savedFlights,
    savedQueries,
    uef,
}: SearchBoxProps): JSX.Element => {
    return (
        <div>
            <div class="unelevated_form">
                <div class="unelevated_title">
                    <a
                        href={`https://www.cathaypacific.com/cx/${browserLang}_${browserCountry}/book-a-trip/redeem-flights/redeem-flight-awards.html`}
                    >
                        Unelevated Award Search
                    </a>
                </div>

                <div class="login_prompt hidden">
                    <span class="unelevated_error">
                        <a href={loginUrl}>{lang.login}</a>
                    </span>
                </div>

                <div class="unelevated_faves hidden">
                    <div class="faves_tabs">
                        <a href="javascript:void 0" class="tabs tab_queries">
                            Routes
                        </a>
                        <a href="javascript:void 0" class="tabs tab_flights">
                            Flights
                        </a>
                    </div>
                    <a href="javascript:void 0" class="search_all_saved">
                        {lang.search_all_saved} &raquo;
                    </a>
                    {SavedFlights({ savedFlights })}
                    {SavedQueries({ savedQueries })}
                </div>

                <div class="unelevated_saved">
                    <a href="javascript:void 0">
                        <Heart className="heart_save" />
                    </a>
                </div>

                <div class="labels">
                    <a href="javascript:void 0" class="switch">
                        <Swap />
                    </a>
                    <label class="labels_left">
                        <span>From</span>
                        <input
                            tabIndex={1}
                            type="search"
                            id="uef_from"
                            name="uef_from"
                            placeholder="Where from?"
                            value={uef.from.join(',')}
                        />
                    </label>
                    <label class="labels_right">
                        <span>Adults</span>
                        <input
                            tabIndex={4}
                            type="number"
                            inputMode="decimal"
                            onFocus={e => e.currentTarget.select()}
                            id="uef_adult"
                            name="uef_adult"
                            placeholder="Adults"
                            value={uef.adults}
                            min={0}
                        />
                    </label>
                    <label class="labels_left">
                        <span>To</span>
                        <input
                            tabIndex={2}
                            type="search"
                            id="uef_to"
                            name="uef_to"
                            placeholder="Where to?"
                            value={uef.to.join(',')}
                        />
                    </label>
                    <label class="labels_right">
                        <span>Children</span>
                        <input
                            tabIndex={5}
                            type="number"
                            inputMode="decimal"
                            onFocus={e => e.currentTarget.select()}
                            id="uef_child"
                            name="uef_child"
                            placeholder="Children"
                            value={uef.children}
                            min={0}
                        />
                    </label>
                    <label class="labels_left">
                        <span>Date</span>
                        <input
                            tabIndex={3}
                            type="date"
                            class="uef_date"
                            id="uef_date"
                            name="uef_date"
                            value={uef.date !== '' && dayjs(uef.date).format('YYYY-MM-DD')}
                            max="9999-12-31"
                        />
                    </label>
                    <button class="uef_search">{lang.search}</button>
                </div>
            </div>

            <div class="multi_box hidden">
                <select id="multi_cabin">
                    <option value="Y">{lang.economy_full}</option>
                    <option value="W">{lang.premium_full}</option>
                    <option value="C">{lang.business_full}</option>
                    <option value="F">{lang.first_full}</option>
                </select>
                <label class="labels_right">
                    <span>Adults</span>
                    <input
                        type="number"
                        inputMode="decimal"
                        onFocus={e => e.currentTarget.select()}
                        id="multi_adult"
                        name="multi_adult"
                        placeholder="Adults"
                        value={1}
                        min={0}
                    />
                </label>
                <label class="labels_right">
                    <span>Children</span>
                    <input
                        type="number"
                        inputMode="decimal"
                        onFocus={e => e.currentTarget.select()}
                        id="multi_child"
                        name="multi_child"
                        placeholder="Children"
                        value={0}
                        min={0}
                    />
                </label>
                <button class="multi_search">{lang.book_multi}</button>
            </div>

            <div class="bulk_box">
                <div class="bulk_results hidden">
                    <div class="filters">
                        <label>
                            <input type="checkbox" checked={savedFilters.nonstop} data-filter="nonstop" />
                            {lang.nonstop}
                        </label>
                        <label>
                            <input type="checkbox" checked={savedFilters.first} data-filter="first" />
                            {lang.first}
                        </label>
                        <label>
                            <input type="checkbox" checked={savedFilters.business} data-filter="business" />
                            {lang.business}
                        </label>
                        <label>
                            <input type="checkbox" checked={savedFilters.premium} data-filter="premium" />
                            {lang.premium}
                        </label>
                        <label>
                            <input type="checkbox" checked={savedFilters.economy} data-filter="economy" />
                            {lang.economy}
                        </label>
                    </div>
                    <table
                        class={classNames('bulk_table', {
                            nonstop_only: savedFilters.nonstop,
                            show_first: savedFilters.first,
                            show_business: savedFilters.business,
                            show_premium: savedFilters.premium,
                            show_economy: savedFilters.economy,
                        })}
                    >
                        <thead>
                            <th class="bulk_date">{lang.date}</th>
                            <th class="bulk_flights">
                                {lang.flights} <span class="info-x info-f">{lang.first}</span>
                                <span class="info-x info-j">{lang.business}</span>
                                <span class="info-x info-p">{lang.premium}</span>
                                <span class="info-x info-y">{lang.economy}</span>
                            </th>
                        </thead>
                        <tbody />
                    </table>
                </div>
                <div class="bulk_footer">
                    <div class="bulk_footer_container">
                        <button class="bulk_submit">
                            {lang.bulk_batch} {uef.from.join(',')} - {uef.to.join(',')} {lang.bulk_flights}
                        </button>
                        <div class="bulk_error hidden">
                            <span />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
