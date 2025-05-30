const webpush = require('web-push');

const keys = webpush.generateVAPIDKeys();
console.log(keys);

// {
//     publicKey: 'BLbnwaj6jGwQgm7uH4Vu_5c_IW2lT0VXruGAwx4BTiiJ1rgvTv7bCjo1DL0q8ukDxv9TFLWa5eV__c7BvaTcqM0',
//         privateKey: 'M1ZDaCwTvBMWCS5Mjm_gs4DA1gbnQLAVesMA4vZyTCk'
// }
