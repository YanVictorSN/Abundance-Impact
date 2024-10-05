const baseURL = process.env.NODE_ENV === 'production' ? process.env.NEXT_PUBLIC_BASE_URL_PROD : process.env.NEXT_PUBLIC_BASE_URL_DEV;

export default function handler(req, res) {
  if (req.method === 'POST') {
    const data = req.body;
    console.log(data);

    res.status(200).json({ 
      type: 'form',
      title: 'Curator page',
      url: 'https://impact.abundance.id/~/curator/9326',
    });
  } else if (req.method === 'GET') {
    res.status(200).json({
        "type": "composer",
        "name": "Curator page",
        "icon": "person",
        "description": "Curator",
        "aboutUrl": "https://impact.abundance.id/~/curator/9326",
        "imageUrl": `${baseURL}/images/input.jpg`,
        "action": {
          "type": "post",
        }
    });
  } else {
    res.status(405).end(); // Method Not Allowed
  }
}