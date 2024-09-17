import satori from "satori";
import path from 'path'
import fs from 'fs';
import { promisify } from 'util';
import svg2img from 'svg2img';

const baseURL = process.env.NODE_ENV === 'production' ? process.env.NEXT_PUBLIC_BASE_URL_PROD : process.env.NEXT_PUBLIC_BASE_URL_DEV;

export default async function handler(req, res) {
  const { points, fid } = req.query

  try {
    const fontPath = path.join(process.cwd(), 'public', 'Inter-SemiBold.ttf');
    const fontData = fs.readFileSync(fontPath);

    async function getHamAllowance(fid) {
      try {
        const remainingUrl = `https://farcaster.dep.dev/ham/user/${fid}`;
        const remainingBalance = await fetch(remainingUrl, {
          headers: { accept: "application/json" },
        });
        const getRemaining = await remainingBalance.json();
        return getRemaining ? Math.floor((Number(getRemaining?.todaysAllocation) - Number(getRemaining?.totalTippedToday))/1e18) : 0;
      } catch (error) {
        console.error('Error in getHamAllowance:', error);
        return 0;
      }
    }
    
    async function getDegenAllowance(fid) {
      try {
        const response = await fetch(`https://api.degen.tips/airdrop2/allowances?fid=${fid}`);
        const data = await response.json();
        return data?.length > 0 ? data[0].remaining_tip_allowance : 0;
      } catch (error) {
        console.error('Error in getDegenAllowance:', error);
        return 0;
      }
    }
    
    async function getWildAllowance(fid) {
      try {
        const remainingUrl = `https://sys.wildcard.lol/tip/public/v1/token/balance/${fid}?currency=WILD`;
        const remainingBalance = await fetch(remainingUrl, {
          headers: { accept: "application/json" },
        });
        const getRemaining = await remainingBalance.json();
        return getRemaining ? Math.floor(Number(getRemaining?.allowance_remaining)) : 0;
      } catch (error) {
        console.error('Error in getWildAllowance:', error);
        return 0;
      }
    }
    
    async function getHuntAllowance(fid) {
      try {
        const remainingUrl = `https://tip.hunt.town/api/stats/fid/${fid}`;
        const remainingBalance = await fetch(remainingUrl, {
          headers: { accept: "application/json" },
        });
        const getRemaining = await remainingBalance.json();
        return getRemaining ? Math.floor(Number(getRemaining?.remaining_allowance)) : 0;
      } catch (error) {
        console.error('Error in getWildAllowance:', error);
        return 0;
      }
    }


    let allowances = [{coin: '$DEGEN', remaining: 0}, {coin: '$HAM', remaining: 0}, {coin: '$WILD', remaining: 0}, {coin: '$HUNT', remaining: 0}]

    for (const allowance of allowances) {
      if (allowance.coin == '$DEGEN') {
        allowance.remaining = await getDegenAllowance(fid)
      } else if (allowance.coin == '$HAM') {
        allowance.remaining = await getHamAllowance(fid)
      } else if (allowance.coin == '$WILD') {
        allowance.remaining = await getWildAllowance(fid)
      } else if (allowance.coin == '$HUNT') {
        allowance.remaining = await getHuntAllowance(fid)
      }
    }

    const backgroundImg = `https://impact.abundance.id/images/backgroundframe.jpg`

    const svg = await satori(
      <div style={{
        width: '100%',
        height: '100%',
        padding: 30,
        display: 'flex',
        flexDirection: 'column',
        backgroundImage: `url(${backgroundImg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: '#43238a',
        justifyContent: 'center',
        alignItems: 'center', 
      }}>
        <div style={{display: 'flex', flexDirection: 'column', color: 'white', 
        fontSize: '22px', alignItems: 'center', justifyContent: 'center'}}>

          <div style={{display: 'flex', textAlign: 'center', color: '#eff', fontSize: '24px', margin: '5px 20px 5px 20px', padding: '0'}}>Main Menu</div>

          <div style={{display: 'flex', flexDirection: 'row', color: 'black', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', border: '1px solid #eeeeeeaa', borderRadius: '16px', padding: '10px', margin: '15px', background: '#eeeeeeaa', width: '500px'}}>
            <div style={{display: 'flex', textAlign: 'left', color:  '#220a4d', fontSize: '18px', margin: '5px 10px 5px 10px', width: '140px'}}>What&apos;s /impact:</div>
            <div style={{display: 'flex', textAlign: 'left', color: '#220a4d', fontSize: '17px', margin: '5px 10px 5px 0px', width: '360px'}}>What is /impact & how it works</div>
          </div>

          <div style={{display: 'flex', flexDirection: 'row', color: 'black', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', border: '1px solid #eeeeeeaa', borderRadius: '16px', padding: '10px', margin: '15px', background: '#eeeeeeaa', width: '500px'}}>
            <div style={{display: 'flex', textAlign: 'left', color:  '#220a4d', fontSize: '18px', margin: '5px 10px 5px 10px', width: '140px'}}>Explore curation:</div>
            <div style={{display: 'flex', textAlign: 'left', color: '#220a4d', fontSize: '17px', margin: '5px 10px 5px 0px', width: '360px'}}>See curator&apos;s cast nominations</div>
          </div>



          <div style={{display: 'flex', flexDirection: 'row', color: 'black', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', border: '1px solid #eeeeeeaa', borderRadius: '16px', padding: '10px', margin: '15px', background: '#eeeeeeaa', width: '500px'}}>
            <div style={{display: 'flex', textAlign: 'left', color:  '#220a4d', fontSize: '18px', margin: '5px 10px 5px 10px', width: '140px'}}>Get Cast Action:</div>
            <div style={{display: 'flex', textAlign: 'left', color: '#220a4d', fontSize: '17px', margin: '5px 10px 5px 0px', width: '360px'}}>Install /impact&apos;s {points} Console in your Farcaster client</div>
          </div>
        

          <div style={{display: 'flex', textAlign: 'center', color: '#eff', fontSize: '20px', margin: '35px 20px 0px 20px', padding: '0'}}>Remaining Allowances</div>


          <div style={{display: 'flex', flexDirection: 'row', color: 'black', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', border: '0px solid #eeeeeeaa', borderRadius: '0px', padding: '0px', margin: '15px', width: '500px'}}>

            {allowances.map((allowance, index) => (<div key={index} style={{display: 'flex', flexDirection: 'column', color: 'black', alignItems: 'center', justifyContent: 'center', gap: '0.15rem', border: '1px solid #eeeeeeaa', borderRadius: '16px', padding: '3px', margin: '0 0 3px 0', background: '#eeeeeeaa', width: '110px', justifyContent: 'center', alignItems: 'center'}}>
              <div style={{display: 'flex', textAlign: 'center', color:  '#220a4d', fontSize: '19px', margin: '2px 0px', width: '110px', justifyContent: 'center', alignItems: 'center'}}>{allowance.remaining}</div>
              <div style={{display: 'flex', textAlign: 'center', color: '#220a4d', fontSize: '15px', margin: '2px 0px', width: '110px', justifyContent: 'center', alignItems: 'center'}}>{allowance.coin}</div>
            </div>))}

          </div>











        </div>
      </div>
      ,
      {
        width: 600, height: 600, 
        fonts: [{
          data: fontData, 
          name: 'Inter', 
          style: 'normal', 
          weight: 600
        }]
      }
    );

    const svgBuffer = Buffer.from(svg);
    const convertSvgToPng = promisify(svg2img);
    const pngBuffer = await convertSvgToPng(svgBuffer, { format: 'png', width: 600, height: 600 });

    // Set the content type to PNG and send the response
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.send(pngBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating image');
  }
}
