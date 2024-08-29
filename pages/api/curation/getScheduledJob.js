import { decryptPassword } from '../../../utils/utils';
import connectToDatabase from '../../../libs/mongodb';
import ScheduleTip from '../../../models/ScheduleTip';
import Cast from '../../../models/Cast';
import Impact from '../../../models/Impact';
import User from '../../../models/User';
import Tip from '../../../models/Tip';
import EcosystemRules from '../../../models/EcosystemRules';
import { getTimeRange, processTips, populateCast } from '../../../utils/utils';

const secretKey = process.env.SECRET_KEY
const apiKey = process.env.NEYNAR_API_KEY

export default async function handler(req, res) {
  const { fid, code } = req.query

  if (req.method !== 'GET' || !fid || !code) {
    res.status(405).json({ error: 'Method Not Allowed', message: 'Failed to provide required data' });
  } else {
    console.log('20 process')
    res.status(202).json({ message: 'Processing started' });
    setImmediate(async () => {
      await runAutoTipping(fid, code, req);
    });
  }
}


async function runAutoTipping(fid, code, req) {
  console.log('30 triggered')
  async function getSchedule(code) {
    try {
      await connectToDatabase();

      const schedule = await ScheduleTip.findOne({ code: code }).select('search_shuffle search_time search_tags points search_channels search_curators percent_tip ecosystem_name currencies uuid').exec();
      console.log('schedule 28', schedule)
      if (schedule) {
        const decryptedUuid = decryptPassword(schedule.uuid, secretKey);
        return {
          shuffle: schedule.search_shuffle,
          timeRange: schedule.search_time,
          tags: schedule.search_tags,
          points: schedule.points,
          channels: schedule.search_channels,
          curators: schedule.search_curators,
          percent: schedule.percent_tip,
          ecosystem: schedule.ecosystem_name,
          currencies: schedule.currencies,
          decryptedUuid: decryptedUuid
        }
      } else {
        return {
          shuffle: null,
          timeRange: null,
          tags: null,
          points: null, 
          channels: null,
          curators: null,
          percent: null,
          ecosystem: null,
          currencies: null,
          decryptedUuid: null
        }
      }
    } catch (error) {
      console.error('Error:', error);
      return {
        shuffle: null,
        timeRange: null,
        tags: null,
        points: null, 
        channels: null,
        curators: null,
        percent: null,
        ecosystem: null,
        currencies: null,
        decryptedUuid: null
      }
    }
  }
  
  const { shuffle, timeRange, tags, points, channels, curators, percent, ecosystem, currencies, decryptedUuid } = await getSchedule(code)
  
  console.log('schedule 47', shuffle, timeRange, tags, points, channels, curators, percent, ecosystem, currencies)
  
  if (!percent || !decryptedUuid) {
    res.status(500).json({ error: 'Internal Server Error' });
  } else {
    
    async function getCuratorPercent(points) {
      try {
        await connectToDatabase();

        const curatorPercentData = await EcosystemRules.findOne({ ecosystem_points_name: points }).select('percent_tipped').exec();
        console.log(curatorPercentData)
        if (curatorPercentData) {
          const curatorPercent = curatorPercentData?.percent_tipped
          return curatorPercent
        } else {
          return 10
        }
      } catch (error) {
        console.error('Error:', error);
        return 10
      }
    }

    const curatorPercent = await getCuratorPercent(points)
    console.log(curatorPercent)

    let time = null
    if (timeRange) {
      time = getTimeRange(timeRange)
    }
    console.log(time)

    async function getDegenAllowance(fid) {
      try {
        const response = await fetch(`https://api.degen.tips/airdrop2/allowances?fid=${fid}`);
        const data = await response.json();
        
        if (data?.length > 0) {
          const remainingAllowance = data[0].remaining_tip_allowance;
          console.log('Latest remaining_tip_allowance:', remainingAllowance);
          return remainingAllowance;
        } else {
          console.log('No data found.');
          return 0;
        }
      } catch (error) {
        return 0;
      }
    }

    async function getHamAllowance(fid) {
      try {
        const remainingUrl = `https://farcaster.dep.dev/lp/tips/${fid}`;
        const remainingBalance = await fetch(remainingUrl, {
          headers: {
            accept: "application/json",
          },
        });
        const getRemaining = await remainingBalance.json()
        let remaining = 0
  
        if (getRemaining) {
          console.log(getRemaining)
          remaining = Number(getRemaining.allowance) - Number(getRemaining.used)
        }
        return remaining
      } catch (error) {
        console.error('Error handling GET request:', error);
        return 0
      }
    }

    async function getFartherAllowance(fid) {
      try {
        const input = encodeURIComponent(JSON.stringify({ fid: fid }))
        const remainingUrl = `https://farther.social/api/v1/public.user.byFid?input=${input}`;
        const fartherData = await fetch(remainingUrl, {
          headers: {
            accept: "application/json",
          },
        });
        let allowance = 0
        let remainingAllowance = 0
        let tipMin = 0
        if (fartherData?.status == 200) {
          const fartherInfo = await fartherData.json()
          allowance = fartherInfo?.result?.data?.tips?.currentCycle?.allowance
          tipMin = fartherInfo?.result?.data?.tips?.currentCycle?.tipMinimum
          remainingAllowance = fartherInfo?.result?.data?.tips?.currentCycle?.remainingAllowance
          if (!remainingAllowance) {
            remainingAllowance = allowance
          }
        }
        let remaining = 0
        let minTip = 1
        if (remainingAllowance) {
          remaining = Number(remainingAllowance)
        }
        if (tipMin) {
          minTip = Number(tipMin)
        }
        return { allowance: remaining, minTip }
      } catch (error) {
        console.error('Error handling GET request:', error);
        return { allowance: 0, minTip: 1 }
      }
    }

    let allowances = []
    for (const coin of currencies) {
      if (coin == '$TN100x') {
        const allowance = await getHamAllowance(fid)
        const tip = Math.floor(allowance * percent / 100)
        const allowanceData = {token: coin, set: true, allowance: tip, totalTip: tip}
        allowances.push(allowanceData)
      } else if (coin == '$DEGEN') {
        const allowance = await getDegenAllowance(fid)
        const tip = Math.round(allowance * percent / 100)
        const allowanceData = {token: coin, set: true, allowance: tip, totalTip: tip}
        allowances.push(allowanceData)
      } else if (coin == '$FARTHER') {
        const {allowance, minTip} = await getFartherAllowance(fid)
        const tip = Math.round(allowance * percent / 100)
        const allowanceData = {token: coin, set: true, allowance: tip, totalTip: tip, min: minTip}
        allowances.push(allowanceData)
      }
    }

    console.log('141', allowances)

    if (allowances.length == 0) {
      console.log('Internal Server Error');
    } else {

      async function getUserSearch(time, tags, channel, curator, points) {
    
        const page = 1;
        const limit = 10;
        const skip = (page - 1) * limit;
    
        let query = {};
            
        async function getCuratorIds(fids) {
          try {
            await connectToDatabase();
            const impacts = await Impact.find({ curator_fid: { $in: fids }, points }).select('_id');
            const impactIds = impacts.map(impact => impact._id);
            return impactIds
          } catch (error) {
            console.error("Error while fetching casts:", error);
            return null
          }   
        }
        
        if (time) {
          query.createdAt = { $gte: time } ;
        }

        if (points) {
          query.points = points
        }
      
        if (curator && curator.length > 0) {
          let curatorFids

          if (typeof curator === 'string') {
            curatorFids = [parseInt(curator)];
          } else if (Array.isArray(curator) && curator.length > 0) {
            curatorFids = curator.map(fid => parseInt(fid));
          }

          // curatorFids = curator.map(fid => parseInt(fid));
    
          let impactIds
          if (curatorFids) {
            impactIds = await getCuratorIds(curatorFids)
          }
          if (impactIds) {
            query['impact_points'] = { $in: impactIds }
          }
        }
        
        // if (tags && tags.length > 0) {
        //   query.cast_tags = { $in: [tags] };
        // }
    
        if (req.query['channel[]'] && req.query['channel[]'].length > 0) {

          if (typeof req.query['channel[]'] === 'string') {
            query.cast_channel = { $in: [req.query['channel[]']]};
          } else if (Array.isArray(req.query['channel[]']) && req.query['channel[]'].length > 0) {
            query.cast_channel = { $in: req.query['channel[]']};
          }
                
          // query.cast_channel = { $in: [req.query['channel[]']] };
        }
    
        // if (text) {
        //   query.cast_text = { $regex: text, $options: 'i' }; // Case-insensitive search
        // }
        
        function shuffleArray(array) {
          for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
          }
          return array;
        }
  
      async function fetchCasts(query, page, limit) {
        try {
          await connectToDatabase();
      
          let totalCount;
          let returnedCasts = []
          let shuffle = true
          if (!shuffle) {
            totalCount = await Cast.countDocuments(query);
            returnedCasts = await Cast.find(query)
              .sort({ impact_total: -1 })
              .populate('impact_points')
              .skip((page - 1) * limit)
              .limit(limit)
              .exec();
            // console.log('63', returnedCasts)
          } else {
  
            totalCount = await Cast.countDocuments(query);
      
            // Calculate the number of documents to be sampled from each range
            const top20PercentCount = Math.ceil(totalCount * 0.2);
            const middle40PercentCount = Math.ceil(totalCount * 0.4);
            const bottom40PercentCount = totalCount - top20PercentCount - middle40PercentCount;
      
            // Fetch documents from each range
            const top20PercentCasts = await Cast.find(query)
              .sort({ impact_total: -1 })
              .populate('impact_points')
              .limit(top20PercentCount)
              .exec();
            const middle40PercentCasts = await Cast.find(query)
              .sort({ impact_total: -1 })
              .populate('impact_points')
              .skip(top20PercentCount)
              .limit(middle40PercentCount)
              .exec();
            const bottom40PercentCasts = await Cast.find(query)
              .sort({ impact_total: -1 })
              .populate('impact_points')
              .skip(top20PercentCount + middle40PercentCount)
              .limit(bottom40PercentCount)
              .exec();
      
            returnedCasts = top20PercentCasts.concat(middle40PercentCasts, bottom40PercentCasts);
      
            returnedCasts.sort((a, b) => b.impact_total - a.impact_total);
      
            returnedCasts = returnedCasts.reduce((acc, current) => {
              const existingItem = acc.find(item => item._id === current._id);
              if (!existingItem) {
                acc.push(current);
              }
              return acc;
            }, [])
  
            returnedCasts = shuffleArray(returnedCasts);
      
            returnedCasts = returnedCasts.slice(0, limit);
          }
      
          if (returnedCasts && returnedCasts.length > 10) {
            returnedCasts = returnedCasts.slice(0, 10);
          }
      
          // console.log('113', returnedCasts)
          if (!returnedCasts) {
            returnedCasts = []
          }
          return { casts: returnedCasts, totalCount };
        } catch (err) {
          console.error(err);
          return { casts: null, totalCount: null};
        }
      }
      
      const { casts, totalCount } = await fetchCasts(query);
      // console.log('223', casts, totalCount)

      return { casts, totalCount }
      }  
  
      const { casts } = await getUserSearch(time, tags, channels, curators, points)
    
      console.log(casts)
      // console.log(casts[0].impact_points)

      let filteredCasts = await casts.reduce((acc, current) => {
        const existingItem = acc.find(item => item._id === current._id);
        if (!existingItem) {
          acc.push(current);
        }
        return acc;
      }, [])

      let sortedCasts = filteredCasts.sort((a, b) => b.impact_total - a.impact_total);
    
      let displayedCasts = await populateCast(sortedCasts)

      let curatorHashes = []

      async function getHash(fid) {
        try {
          await connectToDatabase();
          const user = await User.findOne({ fid }).select('set_cast_hash').exec();
          if (user) {
            const castHash = user.set_cast_hash
            return castHash
          } else {
            return null
          }
        } catch (error) {
          console.error('Error getting User:', error)
          return null
        }
      }

      for (const cast of displayedCasts) {
        if (cast.impact_points && cast.impact_points.length > 0) {
          for (const subCast of cast.impact_points) {
            let fidExists = curatorHashes.some(item => item.fid == subCast.curator_fid)
            if (subCast.curator_fid !== fid && !fidExists) {
              let curatorHash = await getHash(subCast.curator_fid)
              let hash = {fid: subCast.curator_fid, hash: curatorHash, impact_points: subCast.impact_points}
              curatorHashes.push(hash)
              subCast.target_cast_hash = curatorHash
            } else if (fidExists) {
              const curatorIndex = curatorHashes.findIndex(item => item.fid == subCast.curator_fid);
              if (curatorIndex !== -1) {
                subCast.target_cast_hash = curatorHashes[curatorIndex].hash
                curatorHashes[curatorIndex].impact_points += subCast.impact_points
              }
            }
          }
        }
      }

      for (const cast of displayedCasts) {
        if (cast.impact_points && cast.impact_points.length > 0) {
          for (const subCast of cast.impact_points) {
            subCast.impact_points = 0
          }
        }
      }
      
      if (curatorHashes && curatorHashes.length > 0) {
        let i = 0
        for (const cast of displayedCasts) {
          if (cast.impact_points && cast.impact_points.length > 0) {
            for (const subCast of cast.impact_points) {
              if (curatorHashes.length > i && subCast.curator_fid == curatorHashes[i].fid) {
                subCast.impact_points = curatorHashes[i].impact_points;
                i++;
              }
            }
          }
        }
      }
      
      const { castData, coinTotals } = await processTips(displayedCasts, fid, allowances, ecosystem, curatorPercent)

      console.log('castData', castData)

      async function sendRequests(data, signer, apiKey) {
        const base = "https://api.neynar.com/";
        const url = `${base}v2/farcaster/cast`;
        let tipCounter = 0;
        for (const cast of data) {
          const castText = cast.text;
          const parentUrl = cast.castHash;
          let body = {
            signer_uuid: signer,
            text: castText,
          };
  
          if (parentUrl) {
            body.parent = parentUrl;
          }
  
          try {
            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'api_key': apiKey,
              },
              body: JSON.stringify(body),
            });
  
            if (!response.ok) {
              // console.error(`Failed to send request for ${castText}`);
            } else {
              // console.log(`Request sent successfully for ${castText}`);
            }
            let tips = []
  
            for (const coin of cast.allCoins) {
              let amount = 0
              if (coin.coin == '$TN100x' && coin.tip > 0) {
                amount = coin.tip
              } else if (coin.tip > 0) {
                amount = coin.tip
              }
              if (coin.tip > 0) {
                let tip = {currency: coin.coin, amount: amount}
                tips.push(tip)
              }
            }
            
            await Tip.create({
              receiver_fid: cast.fid,
              tipper_fid: fid,
              points: points, 
              cast_hash: cast.castHash,
              tip: tips,
            });
            // tipCounter += Number(cast.tip)
  
          } catch (error) {
            console.error(`Error occurred while sending request for ${castText}:`, error);
          }
  
          await new Promise(resolve => setTimeout(resolve, 60));
        }
        return tipCounter
      }
  
      try {
        const remainingTip = await sendRequests(castData, decryptedUuid, apiKey);
        // const remainingTip = 0
        console.log('All casts tipped successfully', remainingTip );
      } catch (error) {
        console.error('Error sending requests:', error);
      }
    }
  }
}