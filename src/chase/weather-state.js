// Shared weather uniforms. Materials compile these in once and the weather
// controller writes them each frame; at 0 every surface renders as before.
export const WET={value:0};       // surface soaking, 0 dry .. 1 drenched
export const RAIN={value:0};      // falling-rain intensity (puddle ripples)
export const RAIN_TIME={value:0}; // ripple clock, advances only while unpaused
export const WIND_GUST={value:1}; // foliage sway multiplier
