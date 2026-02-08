/// Mock I64 type used by the mock oracle (replaces pyth::i64 for testnet/mainnet without Pyth dependency).
/// Same API surface as Pyth's I64 for price/exponent in collateral_value_from_oracle.
module rain::i64;

/// Signed 64-bit value represented as sign + magnitude (used for price and exponent).
public struct I64 has copy, drop, store {
    negative: bool,
    magnitude: u64,
}

public fun create(negative: bool, magnitude: u64): I64 {
    I64 { negative, magnitude }
}

public fun get_is_negative(i: &I64): bool {
    i.negative
}

public fun get_magnitude_if_negative(i: &I64): u64 {
    if (i.negative) { i.magnitude } else { 0 }
}

public fun get_magnitude_if_positive(i: &I64): u64 {
    if (!i.negative) { i.magnitude } else { 0 }
}
