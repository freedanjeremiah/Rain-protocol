/// Oracle adapter: wraps Pyth price feeds. Used by RiskEngine and Adjudicator for LTV/liquidation.
/// No custody, no vault logic. Same Pyth API as deepbook-amm vault (get_price_no_older_than).
module rain::oracle_adapter;

use sui::clock::Clock;
use pyth::{pyth, price_info, price_identifier, price, i64};
use pyth::price_info::PriceInfoObject;

const EInvalidPriceFeedId: u64 = 0;

/// Returns (price, exponent) for the given price feed. Asserts the PriceInfoObject's feed id matches.
/// `max_age_secs`: max age of price in seconds (e.g. 60).
public fun get_price(
    price_feed_id: vector<u8>,
    price_info_object: &PriceInfoObject,
    clock: &Clock,
    max_age_secs: u64,
): (i64::I64, i64::I64) {
    let price_struct = pyth::get_price_no_older_than(price_info_object, clock, max_age_secs);
    let price_info = price_info::get_price_info_from_price_info_object(price_info_object);
    let price_id = price_identifier::get_bytes(&price_info::get_price_identifier(&price_info));
    assert!(price_id == price_feed_id, EInvalidPriceFeedId);
    let p = price::get_price(&price_struct);
    let e = price::get_expo(&price_struct);
    (p, e)
}
