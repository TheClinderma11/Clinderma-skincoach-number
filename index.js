const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const KYLAS_API_KEY = '9586b3b9-fc53-4a4b-9a89-721a870d78c9:17063';
const KYLAS_INCOMING_URL = 'https://call.integrations.kylas.io/api/tata_tele_smart_flo/1305/8d6fa461-169f-45b4-9012-d1c0d5309933/handler/incoming.json';
const KYLAS_BASE = 'https://api.kylas.io';
const BUSY_IVR_ID = '83108';

const COACH_ROUTING = {
  'Pooja Verma': '8657128575',
  'Neha Shimpi': '9004063091',
  'Kaushal Tonpe': '9004701572',
  'Aasavari Kerekar': '9326429166',
  'Mohini Kar': '9767628104',
  'Kasireddy Likitha': '9004702184',
  'Demo Account': '7715842331'
};

const kylasHeaders = {
  'api-key': KYLAS_API_KEY,
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};

function normalizePhone(num) {
  if (!num) return '';
  return String(num).replace(/^\+?91/, '').replace(/\D/g, '');
}

// ============================================
// /webhook — incoming call routing
// ============================================
app.post('/webhook', async (req, res) => {
  try {
    let callerNumber = req.body.caller_id_number;

    if (!callerNumber) {
      console.log('No caller number — Busy IVR');
      return res.json([{ transfer: { type: 'ivr', data: [BUSY_IVR_ID] } }]);
    }

    console.log('Incoming call from:', callerNumber);
    callerNumber = normalizePhone(callerNumber);

    const response = await axios.post(
      KYLAS_BASE + '/v1/search/deal',
      {
        fields: ['name', 'id', 'ownedBy', 'pipeline', 'updatedAt'],
        jsonRule: {
          condition: 'AND',
          rules: [{
            operator: 'contains',
            id: 'cfContactNumber',
            field: 'customFieldValues.cfContactNumber',
            type: 'string',
            value: callerNumber,
            relatedFieldIds: null
          }],
          valid: true
        }
      },
      { headers: kylasHeaders, timeout: 5000 }
    );

    const deals = response.data.content;
    if (!deals || deals.length === 0) {
      console.log('No deal found — Busy IVR');
      return res.json([{ transfer: { type: 'ivr', data: [BUSY_IVR_ID] } }]);
    }

    const skincoachDeals = deals.filter(function(d) {
      return d.pipeline && d.pipeline.name && d.pipeline.name.toLowerCase().includes('skincoach');
    });
    var relevantDeals = skincoachDeals.length > 0 ? skincoachDeals : deals;
    var latestDeal = relevantDeals.reduce(function(latest, deal) {
      return new Date(deal.updatedAt) > new Date(latest.updatedAt) ? deal : latest;
    });

    var coachName = latestDeal.ownedBy.name;
    var coachMobile = COACH_ROUTING[coachName];

    if (!coachMobile) {
      console.log('Coach "' + coachName + '" not in routing table — Busy IVR');
      return res.json([{ transfer: { type: 'ivr', data: [BUSY_IVR_ID] } }]);
    }

    console.log('Routing to ' + coachName + ' (' + coachMobile + ')');

    // Kylas screen pop
    // Kylas screen pop
    try {
      var screenPopPayload = {
        uuid: req.body.uuid,
        call_to_number: req.body.call_to_number,
        caller_id_number: callerNumber,
        start_stamp: req.body.start_stamp,
        answer_agent_number: '+91' + coachMobile,
        call_id: req.body.call_id,
        billing_circle: req.body.billing_circle,
        call_status: 'Answered',
        direction: req.body.direction,
        customer_no_with_prefix: req.body.customer_no_with_prefix
      };
      console.log('Screen pop payload:', JSON.stringify(screenPopPayload));
      var popResponse = await axios.post(KYLAS_INCOMING_URL, screenPopPayload, {
        headers: { 'Content-Type': 'application/json' },
        maxRedirects: 0,
        validateStatus: function(s) { return true; },
        timeout: 3000
      });
      console.log('Screen pop response:', popResponse.status, JSON.stringify(popResponse.data));
    } catch (e) {
      console.log('Screen pop error:', e.message);
    }

    // Chained: ring coach, then Busy IVR on no-answer
    return res.json([{
      transfer: {
        type: 'number',
        data: [coachMobile],
        ring_type: 'order_by',
        skip_active: true
      }
    }]);

  } catch (err) {
    console.log('Webhook error:', err.message);
    return res.json([{ transfer: { type: 'ivr', data: [BUSY_IVR_ID] } }]);
  }
});

// Health check
app.get('/', function(req, res) {
  res.send('Clinderma Helpline Running');
});

var PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log('Server running on port ' + PORT);
});
