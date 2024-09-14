import { decryptPassword } from '../../../utils/utils';
import connectToDatabase from '../../../libs/mongodb';
import ScheduleTip from '../../../models/ScheduleTip';
import Cast from '../../../models/Cast';
import Impact from '../../../models/Impact';
import User from '../../../models/User';
import Tip from '../../../models/Tip';
import EcosystemRules from '../../../models/EcosystemRules';
import { getTimeRange, processTips, populateCast } from '../../../utils/utils';
import { Queue } from 'async-await-queue';

const secretKey = process.env.SECRET_KEY;
const apiKey = process.env.NEYNAR_API_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // const { fid, code } = req.query;
  const { code } = req.query;
  // if (!fid || !code) {
  console.log('code', code);
  if (!code) {
    return res.status(400).json({ error: 'Bad Request', message: 'Missing required parameters' });
  }

  try {
    await connectToDatabase();
    const scheduled = await getScheduled(code);
    console.log('scheduled', scheduled, !scheduled);
    if (!scheduled) {
      return res.status(500).json({ error: 'Internal Server Error' });
    } else {

      const uniquePoints = await getUniquePoints();
  
      for (const points of uniquePoints) {
  
        const curatorPercent = await getCuratorPercent(points);
           
        const uniqueFids = await getUniqueFids(points);
        
        for (const fid of uniqueFids) {
          console.log('fid', fid);
          
          const schedule = await getSchedule(fid, points);
          const time = schedule.timeRange ? getTimeRange(schedule.timeRange) : null;
          const allowances = await getAllowances(fid, schedule.currencies, schedule.percent);
          if (!schedule.percent || !schedule.decryptedUuid || allowances.length === 0) {
            console.log(`Skipping fid ${fid} due to missing percent or decryptedUuid`);
            continue;
          }
  
          const { casts } = await getUserSearch(time, schedule.tags, schedule.channels, schedule.curators, points);
          const displayedCasts = await processCasts(casts, fid);
          const { castData, coinTotals } = await processTips(displayedCasts, fid, allowances, schedule.ecosystem, curatorPercent);
  
          const tipQueue = new Queue(1, 100); // Process 1 tip at a time, with a 100ms delay between each
          let tipCounter = 0;
      
          const tipPromises = castData.map(cast => 
            tipQueue.run(async () => {
              const result = await sendTip(cast, schedule.decryptedUuid, fid, schedule.points);
              console.log('cast', fid, cast);
              // const result = 1;
              tipCounter += result;
            })
          );
  
          console.log('tipPromises', tipCounter);
          await Promise.all(tipPromises);
        }
      }
      res.status(200).json({ message: 'All casts tipped successfully'});
    }

  } catch (error) {
    console.error('Error in handler:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

async function getScheduled(code) {
  console.log('getScheduled1', code);
  try {
    const schedule = await ScheduleTip.findOne({ code: code, fid: 9326 }).select('fid').exec();
    if (schedule) {
      // const decryptedUuid = decryptPassword(schedule.uuid, secretKey);
      return {
        fid: schedule.fid,
      };
    }
    return null;
  } catch (error) {
    console.error('Error in getSchedule:', error);
    return null;
  }
}

async function getSchedule(fid, points) {
  try {
    const schedule = await ScheduleTip.findOne({ fid, points, active_cron: true }).select('search_shuffle search_time search_tags points search_channels search_curators percent_tip ecosystem_name currencies uuid').exec();
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
      };
    }
    return {};
  } catch (error) {
    console.error('Error in getSchedule:', error);
    return {};
  }
}

async function getUniquePoints() {
  try {
    const uniquePoints = await ScheduleTip.distinct('points');
    return uniquePoints;
  } catch (error) {
    console.error('Error in getUniquePoints:', error);
    return [];
  }
}

async function getUniqueFids(points) {
  try {
    const uniqueFids = await ScheduleTip.distinct('fid', { points: points });
    return uniqueFids;
  } catch (error) {
    console.error('Error in getUniqueFids:', error);
    return [];
  }
}

async function getCuratorPercent(points) {
  try {
    const curatorPercentData = await EcosystemRules.findOne({ ecosystem_points_name: points }).select('percent_tipped').exec();
    return curatorPercentData?.percent_tipped || 10;
  } catch (error) {
    console.error('Error in getCuratorPercent:', error);
    return 10;
  }
}

async function getAllowances(fid, currencies, percent) {
  const allowances = [];
  for (const coin of currencies) {
    let allowance, tip, minTip;
    switch (coin) {
      case '$TN100x':
        allowance = await getHamAllowance(fid);
        tip = Math.floor(allowance * percent / 100);
        allowances.push({token: coin, set: true, allowance: tip, totalTip: tip});
        break;
      case '$DEGEN':
        allowance = await getDegenAllowance(fid);
        tip = Math.round(allowance * percent / 100);
        allowances.push({token: coin, set: true, allowance: tip, totalTip: tip});
        break;
      case '$FARTHER':
        ({allowance, minTip} = await getFartherAllowance(fid));
        tip = Math.round(allowance * percent / 100);
        allowances.push({token: coin, set: true, allowance: tip, totalTip: tip, min: minTip});
        break;
    }
  }
  return allowances;
}

async function getHamAllowance(fid) {
  try {
    const remainingUrl = `https://farcaster.dep.dev/lp/tips/${fid}`;
    const remainingBalance = await fetch(remainingUrl, {
      headers: { accept: "application/json" },
    });
    const getRemaining = await remainingBalance.json();
    return getRemaining ? Number(getRemaining.allowance) - Number(getRemaining.used) : 0;
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

async function getFartherAllowance(fid) {
  try {
    const input = encodeURIComponent(JSON.stringify({ fid: fid }));
    const remainingUrl = `https://farther.social/api/v1/public.user.byFid?input=${input}`;
    const fartherData = await fetch(remainingUrl, {
      headers: { accept: "application/json" },
    });
    if (fartherData?.status == 200) {
      const fartherInfo = await fartherData.json();
      const allowance = fartherInfo?.result?.data?.tips?.currentCycle?.allowance || 0;
      const remainingAllowance = fartherInfo?.result?.data?.tips?.currentCycle?.remainingAllowance || allowance;
      const tipMin = fartherInfo?.result?.data?.tips?.currentCycle?.tipMinimum || 1;
      return { allowance: Number(remainingAllowance), minTip: Number(tipMin) };
    }
    return { allowance: 0, minTip: 1 };
  } catch (error) {
    console.error('Error in getFartherAllowance:', error);
    return { allowance: 0, minTip: 1 };
  }
}

async function getUserSearch(time, tags, channel, curator, points) {
  const limit = 10;
  let query = {};
  
  if (time) query.createdAt = { $gte: time };
  if (points) query.points = points;
  
  if (curator && curator.length > 0) {
    const curatorFids = Array.isArray(curator) ? curator.map(fid => parseInt(fid)) : [parseInt(curator)];
    const impactIds = await getCuratorIds(curatorFids, points);
    if (impactIds) query['impact_points'] = { $in: impactIds };
  }
  
  if (channel && channel.length > 0) {
    query.cast_channel = { $in: Array.isArray(channel) ? channel : [channel] };
  }

  const { casts, totalCount } = await fetchCasts(query, limit);
  return { casts, totalCount };
}

async function getCuratorIds(fids, points) {
  try {
    const impacts = await Impact.find({ curator_fid: { $in: fids }, points }).select('_id');
    return impacts.map(impact => impact._id);
  } catch (error) {
    console.error("Error in getCuratorIds:", error);
    return null;
  }   
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function fetchCasts(query, limit) {
  try {
    await connectToDatabase();

    let totalCount;
    let returnedCasts = []

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
    

    if (returnedCasts && returnedCasts.length > 10) {
      returnedCasts = returnedCasts.slice(0, 10);
    }

    // console.log('113', returnedCasts)
    if (!returnedCasts) {
      returnedCasts = []
    }
    return { casts: returnedCasts, totalCount };
  } catch (err) {
    console.error('Error in fetchCasts:', err);
    return { casts: null, totalCount: null };
  }
}

async function processCasts(casts, fid) {
  let filteredCasts = casts.reduce((acc, current) => {
    const existingItem = acc.find(item => item._id === current._id);
    if (!existingItem) {
      acc.push(current);
    }
    return acc;
  }, []);

  let sortedCasts = filteredCasts.sort((a, b) => b.impact_total - a.impact_total);
  let displayedCasts = await populateCast(sortedCasts);

  const curatorHashes = await getCuratorHashes(displayedCasts, fid);
  return updateCastsWithCuratorInfo(displayedCasts, curatorHashes);
}

async function getCuratorHashes(casts, fid) {
  const curatorHashes = [];
  for (const cast of casts) {
    if (cast.impact_points && cast.impact_points.length > 0) {
      for (const subCast of cast.impact_points) {
        if (subCast.curator_fid !== fid && !curatorHashes.some(item => item.fid == subCast.curator_fid)) {
          const curatorHash = await getHash(subCast.curator_fid);
          curatorHashes.push({
            fid: subCast.curator_fid,
            hash: curatorHash,
            impact_points: subCast.impact_points
          });
        }
      }
    }
  }
  return curatorHashes;
}

async function getHash(fid) {
  try {
    const user = await User.findOne({ fid }).select('set_cast_hash').exec();
    return user ? user.set_cast_hash : null;
  } catch (error) {
    console.error('Error in getHash:', error);
    return null;
  }
}

function updateCastsWithCuratorInfo(displayedCasts, curatorHashes) {
  for (const cast of displayedCasts) {
    if (cast.impact_points && cast.impact_points.length > 0) {
      for (const subCast of cast.impact_points) {
        const curatorInfo = curatorHashes.find(item => item.fid == subCast.curator_fid);
        if (curatorInfo) {
          subCast.target_cast_hash = curatorInfo.hash;
          subCast.impact_points = curatorInfo.impact_points;
        }
      }
    }
  }
  return displayedCasts;
}

async function sendTip(cast, signer, fid, points) {
  const base = "https://api.neynar.com/";
  const url = `${base}v2/farcaster/cast`;
  const body = {
    signer_uuid: signer,
    text: cast.text,
    parent: cast.castHash
  };

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
      console.error(`Failed to send request for ${body.text}`);
      return 0;
    }

    const tips = cast.allCoins
      .filter(coin => coin.tip > 0)
      .map(coin => ({ currency: coin.coin, amount: coin.tip }));

    await Tip.create({
      receiver_fid: cast.fid,
      tipper_fid: fid,
      points: points,
      cast_hash: cast.castHash,
      tip: tips,
    });

    return tips.reduce((total, tip) => total + tip.amount, 0);
  } catch (error) {
    console.error(`Error in sendTip for ${cast.text}:`, error);
    return 0;
  }
}