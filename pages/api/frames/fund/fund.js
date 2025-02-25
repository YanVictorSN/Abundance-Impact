import { getSSLHubRpcClient, Message } from "@farcaster/hub-nodejs";
import connectToDatabase from "../../../../libs/mongodb";
import User from "../../../../models/User";
// import Tip from  "../../../../models/Tip";
// import Cast from  "../../../../models/Cast";
// import ImpactFrame from  "../../../../models/ImpactFrame";
// import Raffle from  "../../../../models/Raffle";
// import Impact from  "../../../../models/Impact";
// import Score from  "../../../../models/Score";
import ScheduleTip from  "../../../../models/ScheduleTip";

// import EcosystemRules from  "../../../../models/EcosystemRules";
// import { decryptPassword, getTimeRange, processTips, populateCast } from "../../../../utils/utils";
import _ from "lodash";
import qs from "querystring";
// import { init, validateFramesMessage } from "@airstack/frames";

const baseURL = process.env.NODE_ENV === 'production' ? process.env.NEXT_PUBLIC_BASE_URL_PROD : process.env.NEXT_PUBLIC_BASE_URL_DEV;
const HubURL = process.env.NEYNAR_HUB
const client = HubURL ? getSSLHubRpcClient(HubURL) : undefined;
// const secretKey = process.env.SECRET_KEY
// const apiKey = process.env.NEYNAR_API_KEY

export default async function handler(req, res) {
  // init(process.env.AIRSTACK_API_KEY ?? '')
  // const body = await req.body;
  // const {isValid, message} = await validateFramesMessage(body)
  // console.log('isValid:', isValid)
  const { fund } = req.query;
  const { untrustedData } = req.body
  // const authorFid = message?.data?.frameActionBody?.castId?.fid
  // console.log('ecosystem', ecosystem)
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  } else {

    async function getSigner(fid) {
      try {
        await connectToDatabase();
        const user = await User.findOne({ fid }).select('username').exec();
        if (user) {
          return {
            username: user.username,
            // user_pfp: user.pfp,
          };
        } else {
          return {username: null}
        }
      } catch (error) {
        console.error('Error getting User:', error)
        return { username: null };
      }
    }

    let creator_fund = 100
    let development_fund = 0
    let growth_fund = 0
    if (fund == 'standard') {
      creator_fund = 100
      development_fund = 0
      growth_fund = 0
    } else if (fund == 'optimized') {
      creator_fund = 80
      development_fund = 10
      growth_fund = 10
    } else if (fund == 'accelerated') {
      creator_fund = 60
      development_fund = 20
      growth_fund = 20
    }



    const fid = untrustedData?.fid
    // const fid = 9326
    let circlesImg = ''
    console.log('fid', fid)
    const stopFund = `${baseURL}/api/frames/fund/stop-fund`
    // const stopFund = `${baseURL}/api/frames/fund/stop-fund?${qs.stringify({ ecosystem: ecosystem || 'abundance' })}`
    const loginUrl = `${baseURL}?${qs.stringify({ referrer: fid, autoFund: 'true' })}`
    
    let shareText = ``

    let shareUrl = ``

    let encodedShareText = encodeURIComponent(shareText); 
    let encodedShareUrl = encodeURIComponent(shareUrl); 
    let shareLink = `https://warpcast.com/~/compose?text=${encodedShareText}&embeds[]=${[encodedShareUrl]}`
    
    try {

      const {username} = await getSigner(fid)
      if (!username) {

        res.setHeader('Content-Type', 'application/json');
        res.status(400).json({ 
          message: 'Need to login app'
        });
        return;

      } else if (username) {

        async function getSchedule(fid, points) {
          try {
            await connectToDatabase();
            let fundSchedule = await ScheduleTip.findOne({ fid: Number(fid) }).exec();
            return fundSchedule || null
          } catch (error) {
            console.error("Error while fetching data:", error);
            return null
          }  
        }

        let schedId = null
        let fundSchedule = await getSchedule(fid, '$IMPACT')


        if (fundSchedule) {

          async function updateSchedule(fid) {
            try {
              await connectToDatabase();
              let updated = await ScheduleTip.findOneAndUpdate({ fid: Number(fid) }, { active_cron: true, creator_fund, development_fund, growth_fund, special_fund: 0 }, { new: true, select: '-uuid' });

              const objectIdString = updated._id.toString();
              return objectIdString;
            } catch (error) {
              console.error("Error while fetching data:", error);
              return null
            }  
          }

          schedId = await updateSchedule(fid)
        } else {

          async function getUuid(fid, points) {
            try {
              await connectToDatabase();
              let userData = await User.findOne({ fid, ecosystem_points: points }).select('uuid ecosystem_name').exec();
              
              if (userData) {
                return {encryptedUuid: userData.uuid, ecoName: userData.ecosystem_name}
              } else {
                return {encryptedUuid: null, ecoName: null}
              }
            } catch (error) {
              console.error("Error while fetching data:", error);
              return {encryptedUuid: null, ecoName: null}
            }  
          }
  
          const {encryptedUuid, ecoName} = await getUuid(fid, '$IMPACT')
  

  
          if (!encryptedUuid) {
            console.log('step9')

            res.setHeader('Content-Type', 'application/json');
            res.status(400).json({ 
              message: 'Need to login app'
            });
            return;
          
          } else {
            console.log('step10')

            async function setSchedule(fid, points, ecoName, encryptedUuid, curators) {
    
  
              let newSchedule = null
              try {
                await connectToDatabase();
                newSchedule = new ScheduleTip({ 
                  fid: Number(fid),
                  uuid: encryptedUuid,
                  search_shuffle: true,
                  search_time: 'all',
                  search_tags: [],
                  search_channels: [],
                  search_curators: [],
                  points: points,
                  percent_tip: 100,
                  ecosystem_name: ecoName,
                  currencies: ['$DEGEN'],
                  schedule_time: "45 18 * * *",
                  schedule_count: 1,
                  schedule_total: 1,
                  active_cron: true,
                  creator_fund,
                  development_fund,
                  growth_fund,
                  special_fund: 0,
                });
                
                await newSchedule.save()

                const objectIdString = newSchedule._id.toString();
                return objectIdString;
              } catch (error) {
                console.error("Error while fetching data:", error);
                return null
              }  
            }
      
            schedId = await setSchedule(fid, '$IMPACT', ecoName, encryptedUuid, [])

            console.log('schedId2', schedId)

          }
        }

        if (schedId) {

          console.log('fid', fid)

          circlesImg = `${baseURL}/api/frames/fund/fund-dash?${qs.stringify({ fid, fund })}`

          shareUrl = `https://impact.abundance.id/~/ecosystems/abundance/fund-v3?${qs.stringify({ referrer: fid })}`

          shareText = `I just started auto-funding 2700+ impactful creators & builders on Farcaster with /impact's @impactfund\n\nThis is how we grow Farcaster 👇`

          encodedShareText = encodeURIComponent(shareText)
    
          encodedShareUrl = encodeURIComponent(shareUrl); 
          shareLink = `https://warpcast.com/~/compose?text=${encodedShareText}&embeds[]=${[encodedShareUrl]}`


          let metatags = `
          <meta name="fc:frame:button:1" content="Share">
          <meta name="fc:frame:button:1:action" content="link">
          <meta name="fc:frame:button:1:target" content="${shareLink}" />
          <meta name="fc:frame:button:2" content="Stop Auto-Fund">
          <meta name="fc:frame:button:2:action" content="post">
          <meta name="fc:frame:button:2:target" content="${stopFund}" />
          <meta property="og:image" content="${circlesImg}">
          <meta name="fc:frame:image" content="${circlesImg}">
          <meta name="fc:frame:post_url" content="${loginUrl}">`
    
  
          try {

            res.setHeader('Content-Type', 'text/html');
            res.status(200)
            .send(`
              <!DOCTYPE html>
              <html>
                <head>
                  <title>Auto-Fund | Impact Alpha</title>
                  <meta name="fc:frame" content="vNext">
                  <meta property="og:title" content="Auto-Fund">
                  <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
                  ${metatags}
                </head>
                <body>
                  <div>Tip frame</div>
                </body>
              </html>
            `);
            return;

          } catch (error) {

            res.setHeader('Content-Type', 'application/json');
            res.status(400).json({ 
              message: 'Retry Auto-Funding'
            });
            return;
    
          }




        } else {

          res.setHeader('Content-Type', 'application/json');
          res.status(400).json({ 
            message: 'Retry Auto-Funding'
          });
          return;

        }
        
  
      }
      
    } catch (error) {
      console.log(error, 'g')

      res.setHeader('Content-Type', 'application/json');
      res.status(400).json({ 
        message: 'Need to login app'
      });
      return;

    }
  }
}


