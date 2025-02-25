import satori from "satori";
import path from 'path'
import fs from 'fs';
import { promisify } from 'util';
import svg2img from 'svg2img';

import connectToDatabase from "../../../../libs/mongodb";
import User from '../../../../models/User';

const baseURL = process.env.NODE_ENV === 'production' ? process.env.NEXT_PUBLIC_BASE_URL_PROD : process.env.NEXT_PUBLIC_BASE_URL_DEV;

export default async function handler(req, res) {
  const { status, curators, points, add, remove, needLogin } = req.query

  console.log('at1 status', status, curators, points, typeof curators)
  try {
    const fontPath = path.join(process.cwd(), 'public', 'Inter-SemiBold.ttf');
    const fontData = fs.readFileSync(fontPath);
    const login = needLogin == 'true'
    console.log('at2 login', login, needLogin)
    
    async function getUsernames(curators, points) {
      const curatorsArray = curators.split(',').map(curator => Number(curator.trim()))
      try {
        await connectToDatabase()
        const usernames = await User.find({ fid: { $in: curatorsArray }, ecosystem_points: points }).select('username').exec();
        if (usernames) {
          return usernames
        } else {
          return []
        }
      } catch (error) {
        console.error('Error getting usernames', error);
        return []
      }
    }

    let usernames = []
    if (curators) {
      usernames = await getUsernames(curators, points)
    }

    let removeUsernames = []
    if (remove) {
      removeUsernames = await getUsernames(remove, points)
    }

    let addedUsernames = []
    if (add) {
      addedUsernames = await getUsernames(add, points)
    }

    console.log('at3 usernames', usernames, removeUsernames, addedUsernames)


    const backgroundImg = `${baseURL}/images/backgroundframe3.png`

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

          <div style={{display: 'flex', textAlign: 'center', color: '#eff', fontSize: '24px', margin: '5px 20px 5px 20px', padding: '0'}}>Auto-tip Menu</div>

          {addedUsernames?.length > 0 && (<div style={{display: 'flex', flexDirection: 'row', color: 'black', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', border: '1px solid #686cae99', borderRadius: '16px', padding: '10px', margin: '15px 15px 45px 15px', background: '#ffeebbbb', width: '500px'}}>
            <div style={{display: 'flex', textAlign: 'center', color: '#220a4d', fontSize: '20px', margin: '5px 10px 5px 10px', width: '500px', justifyContent: 'center', alignItems: 'center'}}>Add @{addedUsernames[0]?.username} to Auto-tip list?</div>
          </div>)}

          {removeUsernames?.length > 0 && (<div style={{display: 'flex', flexDirection: 'row', color: 'black', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', border: '1px solid #686cae99', borderRadius: '16px', padding: '10px', margin: '15px 15px 45px 15px', background: '#ffeebbbb', width: '500px'}}>
            <div style={{display: 'flex', textAlign: 'center', color: '#220a4d', fontSize: '20px', margin: '5px 10px 5px 10px', width: '500px', justifyContent: 'center', alignItems: 'center'}}>Remove @{removeUsernames[0]?.username} from Auto-tip list?</div>
          </div>)}

          <div style={{display: 'flex', flexDirection: 'row', color: 'black', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', border: (status == 'all') ? '2px solid #686cae99' : '1px solid #eeeeeeaa', borderRadius: '16px', padding: '10px', margin: '15px', background: (status == 'all') ? '#220a4dbb' : '#eeeeeeaa', width: '500px'}}>
            <div style={{display: 'flex', textAlign: 'left', color:  (status == 'all') ? '#eff' : '#220a4d', fontSize: '17px', margin: '5px 10px 5px 10px', width: '140px'}}>Auto-tip all:</div>
            <div style={{display: 'flex', textAlign: 'left', color:  (status == 'all') ? '#eff' : '#220a4d', fontSize: '16px', margin: '5px 10px 5px 0px', width: '360px'}}>automatically distribute leftover $degen allowance to nominees throughout the ecosystem</div>
          </div>

          <div style={{display: 'flex', flexDirection: 'row', color: 'black', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', border: (status == 'curators') ? '2px solid #686cae99' : '1px solid #eeeeeeaa', borderRadius: '16px', padding: '10px', margin: '15px', background: (status == 'curators') ? '#220a4dbb' : '#eeeeeeaa', width: '500px'}}>
            <div style={{display: 'flex', textAlign: 'left', color:  (status == 'curators') ? '#eff' : '#220a4d', fontSize: '17px', margin: '5px 10px 5px 10px', width: '140px'}}>Auto-tip:</div>

            <div style={{display: 'flex', flexDirection: 'column', color:  (status == 'curators') ? '#eff' : '#220a4d', fontSize: '16px', margin: '5px 10px 5px 0px', width: '320px'}}>
              <div style={{width: '320px'}}>automatically distribute your tip allowance to your nominees</div>
              {(usernames?.length > 0) ? (<div style={{display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '0.25rem', margin: '5px 10px 0px 0px', width: '320px'}}>
                {usernames?.map((username, index) => (
                  <div key={index} style={{display: 'flex', textAlign: 'left', fontSize: '13px', margin: '2px 10px 0px 0px', borderRadius: '10px', background: '#eeeeee22', padding: '3px 10px'}}>@{username.username}</div>
                ))}
              </div>) : (<div style={{fontSize: '0', width: '320px'}}></div>)}
            </div>

          </div>

          {/* <div style={{display: 'flex', flexDirection: 'row', color: 'black', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', border: (status == 'add') ? '2px solid #686cae99' : '1px solid #eeeeeeaa', borderRadius: '16px', padding: '10px', margin: '15px', background: (status == 'add') ? '#220a4dbb' : '#eeeeeeaa', width: '500px'}}>
            <div style={{display: 'flex', textAlign: 'left', color:  (status == 'add') ? '#eff' : '#220a4d', fontSize: '17px', margin: '5px 10px 5px 10px', width: '140px'}}>Add curator:</div>
            <div style={{display: 'flex', textAlign: 'left', color:  (status == 'add') ? '#eff' : '#220a4d', fontSize: '16px', margin: '5px 10px 5px 0px', width: '360px'}}>find and add curator to your auto-tip distribution. stops distribution to ecosystem if previously turned on</div>
          </div> */}

          <div style={{display: 'flex', flexDirection: 'row', color: 'black', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', border: (status == 'off') ? '2px solid #686cae99' : '1px solid #eeeeeeaa', borderRadius: '16px', padding: '10px', margin: '15px', background: (status == 'off') ? '#220a4dbb' : '#eeeeeeaa', width: '500px'}}>
            <div style={{display: 'flex', textAlign: 'left', color:  (status == 'off') ? '#eff' : '#220a4d', fontSize: '17px', margin: '5px 10px 5px 10px', width: '140px'}}>Stop Auto-tip:</div>
            <div style={{display: 'flex', textAlign: 'left', color:  (status == 'off') ? '#eff' : '#220a4d', fontSize: '16px', margin: '5px 10px 5px 0px', width: '360px'}}>stop automatic allowance distribution</div>
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
