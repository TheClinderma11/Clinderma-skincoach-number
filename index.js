const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const KYLAS_API_KEY = '9586b3b9-fc53-4a4b-9a89-721a870d78c9:17063';
const KYLAS_INCOMING_URL = 'https://call.integrations.kylas.io/api/tata_tele_smart_flo/1305/8d6fa461-169f-45b4-9012-d1c0d5309933/handler/incoming.json';

const COACH_ROUTING = {
  'Pooja Verma': '8657128575',
  'Neha Shimpi': '9004063091',
  'Kaushal Tonpe': '9004701572',
  'Aasavari Kerekar': '9326429166',
  'Mohini Kar': '9767628104',
  'Kasireddy Likitha': '9004702184',
  'Demo Account': '7715842331'
};

app.post('/webhook', async (req, res) => {
  try {
    let callerNumber = req.body.caller_id_number;
    const callId = req.body.call_id;
    const uuid = req.body.uuid;
    const startStamp = req.body.start_stamp;
    const callToNumber = req.body.call_to_number;
    const billingCircle = req.body.billing_circle;
    const callStatus = req.body.call_status;
    const direction = req.body.direction;
    const customerNoWithPrefix = req.body.customer_no_with_prefix;

    callerNumber = callerNumber.replace(/^\+?91/, '');

    const response = await axios.post(
      'https://api.kylas.io/v1/search/deal',
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
      {
        headers: {
          'api-key': KYLAS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      }
    );

    const deals = response.data.content;
    if (!deals || deals.length === 0) {
      return res.json([]);
    }

    const skincoachDeals = deals.filter(deal =>
      deal.pipeline && deal.pipeline.name &&
      deal.pipeline.name.toLowerCase().includes('skincoach')
    );

    const relevantDeals = skincoachDeals.length > 0 ? skincoachDeals : deals;

    const latestDeal = relevantDeals.reduce((latest, deal) => {
      return new Date(deal.updatedAt) > new Date(latest.updatedAt) ? deal : latest;
    });

    const coachName = latestDeal.ownedBy.name;
    const coachMobile = COACH_ROUTING[coachName];

    if (!coachMobile) {
      return res.json([]);
    }

    // POST metadata to Kylas incoming.json for screen pop
    try {
      await axios.post(KYLAS_INCOMING_URL, {
        uuid: uuid,
        call_to_number: callToNumber,
        caller_id_number: callerNumber,
        start_stamp: startStamp,
        answer_agent_number: '+91' + coachMobile,
        call_id: callId,
        billing_circle: billingCircle,
        call_status: 'Answered',
        direction: direction,
        'customer_no_with_prefix ': customerNoWithPrefix
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        maxRedirects: 0,
        validateStatus: (status) => status < 500
      });
    } catch (kylaserr) {
      console.log('Kylas screen pop error:', kylaserr.message);
    }

    return res.json([{
      transfer: {
        type: 'number',
        data: [coachMobile],
        ring_type: 'order_by',
        skip_active: true
      }
    }]);

  } catch (err) {
    return res.json([]);
  }
});

app.get('/', (req, res) => {
  res.send('Clinderma Webhook Running');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
