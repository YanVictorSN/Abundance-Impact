import { getSSLHubRpcClient, Message } from "@farcaster/hub-nodejs";
import qs from "querystring";
import { init, validateFramesMessage } from "@airstack/frames";

const baseURL = process.env.NODE_ENV === 'production' ? process.env.NEXT_PUBLIC_BASE_URL_PROD : process.env.NEXT_PUBLIC_BASE_URL_DEV;
const HubURL = process.env.NEYNAR_HUB
const client = HubURL ? getSSLHubRpcClient(HubURL) : undefined;


export default async function handler(req, res) {
  init(process.env.AIRSTACK_API_KEY ?? '')
  const body = await req.body;
  const {isValid, message} = await validateFramesMessage(body)
  console.log('isValid:', isValid)
  const { untrustedData } = req.body
  const { iB, qB, qT, author, iA, qA, ec, login, pt, cu, impact, ql, cI, hash, handle, rS, oO } = req.query;
  
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  } else {
    // console.log('17', iB, qB, qT, author, iA, qA, ecosystem, login, pt, cu, impact, quality, cI)
    // console.log('18', typeof iB, typeof cI, typeof impact, typeof quality)
    const curatorFid = req.body.untrustedData?.fid

    let balanceImg = `${baseURL}/api/frames/console/balance?${qs.stringify({ iB, qB, qT, author, iA, qA, ecosystem: ec, login, pt, cu })}`

    let button1 = ''
    let button2 = ''
    let button3 = ''
    let button4 = ''
    let textField = ''
    let postUrl = `<meta name="fc:frame:post_url" content='https://impact.abundance.id' />`

    const menuImg = `${baseURL}/api/frames/console/main-menu?${qs.stringify({ points: pt, fid: curatorFid })}`

    const shareText = 'I just nominated great builders and creators on /impact. Help support them here:'

    let shareUrl = `https://impact.abundance.id/~/ecosystems/${handle}/tip-basic?${qs.stringify({ curators: curatorFid, eco: pt?.substring(1) })}`
    
    const encodedShareText = encodeURIComponent(shareText); 
    let encodedShareUrl = encodeURIComponent(shareUrl); 
    let shareLink = `https://warpcast.com/~/compose?text=${encodedShareText}&embeds[]=${[encodedShareUrl]}`

    let exploreLink = `https://warpcast.com/~/composer-action?view=prompt&url=https%3A%2F%2Fimpact.abundance.id%2Fapi%2Fmini-app%2Fcurator2%3Ffid%3D${curatorFid}%26points%3D%24IMPACT%26app%3Dmini%26username%3Dabundance%26ecosystem%3Dabundance`

    button1 = `<meta property="fc:frame:button:1" content='Multi-tip' />
    <meta property="fc:frame:button:1:action" content="post" />
    <meta property="fc:frame:button:1:target" content='https://impact.abundance.id/api/frames/console/tip?${qs.stringify({ time: 'all', curators: curatorFid, eco: pt?.substring(1), ecosystem: handle })}' />`

    // button2 = `<meta property="fc:frame:button:2" content='Share Multi-tip' />
    // <meta property="fc:frame:button:2:action" content="link" />
    // <meta property="fc:frame:button:2:target" content='${shareLink}' />`

    button2 = `<meta property="fc:frame:button:2" content='Mini App' />
    <meta property="fc:frame:button:2:action" content="link" />
    <meta property="fc:frame:button:2:target" content='${exploreLink}' />`

    button3 = `<meta property="fc:frame:button:3" content="Auto-tip" />
    <meta property="fc:frame:button:3:action" content="post" />
    <meta property="fc:frame:button:3:target" content='https://impact.abundance.id/api/frames/console/auto-tip?${qs.stringify({ iB, qB, qT, author, iA, qA, ec, login, pt, cu, impact, ql, cI, hash, handle, rS, oO })}' />`

    // button3 = `<meta property="fc:frame:button:3" content="What's /impact?" />
    // <meta property="fc:frame:button:3:action" content="post" />
    // <meta property="fc:frame:button:3:target" content='https://impact.abundance.id/api/frames/console/install?${qs.stringify({ iB, qB, qT, author, iA, qA, ecosystem: ec, login, pt, cu, impact, quality: ql, cI, hash, handle, rS, oO })}' />`
    button4 = `<meta property="fc:frame:button:4" content='< Back' />
    <meta property="fc:frame:button:4:action" content="post" />
    <meta property="fc:frame:button:4:target" content='https://impact.abundance.id/api/frames/console/status?${qs.stringify({ iB, qB, qT, author, iA, qA, ecosystem: ec, login, pt, cu, impact, quality: ql, cI, hash, handle, rS, oO })}' />`
    textField = `<meta name="fc:frame:input:text" content="Eg.: 1000 $Degen, 500 $HAM" />`

    let metatags = button1 + button2 + button3 + button4 + textField + postUrl

    try {

      res.setHeader('Content-Type', 'text/html');
      res.status(200)
      .send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Impact Nav</title>
            <meta name="fc:frame" content="vNext">
            <meta property="og:title" content="Impact Nav">
            <meta property='og:image' content='${menuImg}' />
            <meta property="fc:frame:image:aspect_ratio" content="1:1" />
            <meta property="fc:frame:image" content='${menuImg}' />
            ${metatags}
          </head>
          <body>
            <div>Tip frame</div>
          </body>
        </html>
      `);
      return;

    } catch (error) {

      res.setHeader('Content-Type', 'text/html');
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Impact Nav</title>
            <meta name="fc:frame" content="vNext">
            <meta property="og:title" content="Impact Nav">
            <meta property='og:image' content='${menuImg}' />
            <meta property="fc:frame:image:aspect_ratio" content="1:1" />
            <meta property="fc:frame:image" content='${menuImg}' />
            ${metatags}
          </head>
          <body>
            <div>Tip frame</div>
          </body>
        </html>
      `);
      return;
    }
  }
}