const CITIES = {
  Mumbai: { lat: 19.0760, lng: 72.8777 },
  Delhi: { lat: 28.7041, lng: 77.1025 },
  Bengaluru: { lat: 12.9716, lng: 77.5946 },
  Pune: { lat: 18.5204, lng: 73.8567 },
  Ahmedabad: { lat: 23.0225, lng: 72.5714 },
  Kolkata: { lat: 22.5726, lng: 88.3639 },
  Chennai: { lat: 13.0827, lng: 80.2707 },
  Hyderabad: { lat: 17.3850, lng: 78.4867 }
};

const REGIONS = {
  west: "Western India & Coasts",
  central: "Central India",
  desert: "Rajasthan & Gujarat",
  himalaya: "Himalayas & North East",
  south: "South India",
  east: "East India & Islands"
};

const DESTINATIONS = [
  // ===== WEST (Maharashtra, Goa, Gujarat) =====
  { name: "Lonavala", state: "Maharashtra", region: "west", lat: 18.7546, lng: 73.4062, cost: 2200, minD: 2, maxD: 3, tags: ["solo", "family", "elders"], hl: "Ghat-top viewpoints and waterfall trails." },
  { name: "Alibaug", state: "Maharashtra", region: "west", lat: 18.6414, lng: 72.8722, cost: 2500, minD: 2, maxD: 3, tags: ["solo", "family"], hl: "Beach forts reachable by ferry." },
  { name: "Mahabaleshwar", state: "Maharashtra", region: "west", lat: 17.9307, lng: 73.6477, cost: 2400, minD: 2, maxD: 4, tags: ["family", "elders"], hl: "Strawberry farms and gentle valley viewpoints." },
  { name: "Matheran", state: "Maharashtra", region: "west", lat: 18.9871, lng: 73.2699, cost: 2000, minD: 1, maxD: 2, tags: ["solo", "family"], hl: "Vehicle-free hill town, walk or pony." },
  { name: "Nashik", state: "Maharashtra", region: "west", lat: 19.9975, lng: 73.7898, cost: 2100, minD: 2, maxD: 3, tags: ["family", "solo"], hl: "Vineyard tours and riverside temples." },
  { name: "Daman", state: "Daman & Diu", region: "west", lat: 20.3974, lng: 72.8328, cost: 1800, minD: 1, maxD: 2, tags: ["solo", "family"], hl: "Quiet Portuguese-era promenade." },
  { name: "Diu", state: "Daman & Diu", region: "west", lat: 20.7142, lng: 70.9877, cost: 2000, minD: 2, maxD: 3, tags: ["solo", "elders"], hl: "Sun-kissed beaches and Portuguese fort." },
  { name: "Goa", state: "Goa", region: "west", lat: 15.2993, lng: 74.1240, cost: 3200, minD: 3, maxD: 5, tags: ["solo", "family"], hl: "Beach shacks, old churches, flea markets." },
  { name: "Pune", state: "Maharashtra", region: "west", lat: 18.5204, lng: 73.8567, cost: 1900, minD: 1, maxD: 2, tags: ["solo", "family", "elders"], hl: "Heritage forts and a walkable old city." },
  { name: "Kolad", state: "Maharashtra", region: "west", lat: 18.2000, lng: 73.4400, cost: 2600, minD: 2, maxD: 2, tags: ["solo"], hl: "White-water rafting on the Kundalika." },
  { name: "Dandeli", state: "Karnataka", region: "west", lat: 15.2347, lng: 74.6181, cost: 2200, minD: 2, maxD: 3, tags: ["solo", "family"], hl: "River rafting and jungle river cruises." },
  { name: "Gir", state: "Gujarat", region: "west", lat: 21.1247, lng: 70.8242, cost: 2800, minD: 2, maxD: 3, tags: ["family", "elders"], hl: "The last Asiatic lions in the wild." },
  { name: "Kutch", state: "Gujarat", region: "west", lat: 23.7339, lng: 69.8597, cost: 2600, minD: 3, maxD: 4, tags: ["solo", "family"], hl: "White salt desert under the full moon." },
  { name: "Statue of Unity", state: "Gujarat", region: "west", lat: 21.8380, lng: 73.7191, cost: 2000, minD: 1, maxD: 2, tags: ["family", "elders"], hl: "World's tallest statue overlooking the Narmada." },
  { name: "Tarkarli", state: "Maharashtra", region: "west", lat: 16.0405, lng: 73.4670, cost: 1900, minD: 2, maxD: 3, tags: ["solo", "family"], hl: "Scuba diving and quiet white-sand beach." },
  { name: "Saputara", state: "Gujarat", region: "west", lat: 20.5797, lng: 73.7425, cost: 2100, minD: 2, maxD: 3, tags: ["family", "elders"], hl: "Gujarat's only hill station, ropeway views." },
  { name: "Silvassa", state: "Dadra & Nagar Haveli", region: "west", lat: 20.2679, lng: 73.0150, cost: 1900, minD: 1, maxD: 2, tags: ["family", "elders"], hl: "Tribal heritage and riverside resorts." },
  { name: "Bhandardara", state: "Maharashtra", region: "west", lat: 19.5683, lng: 73.7500, cost: 2200, minD: 2, maxD: 3, tags: ["solo", "family"], hl: "Lake-side camping under Sahyadri stars." },
  { name: "Ratnagiri", state: "Maharashtra", region: "west", lat: 16.9902, lng: 73.3120, cost: 1800, minD: 2, maxD: 3, tags: ["solo", "elders"], hl: "Alphonso mango belt with cliff forts." },

  // ===== CENTRAL (MP) =====
  { name: "Pachmarhi", state: "Madhya Pradesh", region: "central", lat: 22.4676, lng: 78.4335, cost: 2300, minD: 3, maxD: 4, tags: ["family"], hl: "Cool plateau with waterfalls and caves." },
  { name: "Khajuraho", state: "Madhya Pradesh", region: "central", lat: 24.8318, lng: 79.9199, cost: 2400, minD: 2, maxD: 3, tags: ["family", "elders"], hl: "Ancient temple carvings of the Chandela era." },
  { name: "Orchha", state: "Madhya Pradesh", region: "central", lat: 25.3514, lng: 78.6412, cost: 2200, minD: 2, maxD: 3, tags: ["solo", "family"], hl: "Riverside palaces and painted cenotaphs." },
  { name: "Bandhavgarh", state: "Madhya Pradesh", region: "central", lat: 23.6988, lng: 80.9630, cost: 3200, minD: 3, maxD: 4, tags: ["solo", "family"], hl: "Tiger safari with dramatic fortress ruins." },
  { name: "Kanha", state: "Madhya Pradesh", region: "central", lat: 22.3241, lng: 80.6358, cost: 3300, minD: 3, maxD: 4, tags: ["solo", "family"], hl: "The original Jungle Book country." },
  { name: "Sundargarh", state: "Odisha", region: "central", lat: 22.1240, lng: 84.0330, cost: 2000, minD: 2, maxD: 3, tags: ["family", "elders"], hl: "Lesser-known hilly escape in central India." },

  // ===== RAJASTHAN =====
  { name: "Udaipur", state: "Rajasthan", region: "desert", lat: 24.5854, lng: 73.7125, cost: 3400, minD: 3, maxD: 5, tags: ["family", "elders"], hl: "Lake palaces and calm boat rides." },
  { name: "Jaipur", state: "Rajasthan", region: "desert", lat: 26.9124, lng: 75.7873, cost: 3000, minD: 3, maxD: 4, tags: ["family", "elders", "solo"], hl: "Forts, bazaars, and pink-city architecture." },
  { name: "Jodhpur", state: "Rajasthan", region: "desert", lat: 26.2389, lng: 73.0243, cost: 3100, minD: 3, maxD: 4, tags: ["family"], hl: "Blue rooftops beneath Mehrangarh Fort." },
  { name: "Jaisalmer", state: "Rajasthan", region: "desert", lat: 26.9157, lng: 70.9083, cost: 2900, minD: 3, maxD: 5, tags: ["solo", "family"], hl: "Golden fort and dunes of the Thar." },
  { name: "Pushkar", state: "Rajasthan", region: "desert", lat: 26.4899, lng: 74.5511, cost: 2400, minD: 2, maxD: 3, tags: ["solo", "elders"], hl: "Riverside ghats and the world-famous camel fair." },
  { name: "Ranthambore", state: "Rajasthan", region: "desert", lat: 26.0173, lng: 76.5026, cost: 3100, minD: 2, maxD: 3, tags: ["solo", "family"], hl: "Tigers prowling old fort ramparts." },
  { name: "Bikaner", state: "Rajasthan", region: "desert", lat: 28.0229, lng: 73.3119, cost: 2500, minD: 2, maxD: 3, tags: ["family", "elders"], hl: "Rare havelis and the junagarh fortress." },
  { name: "Mount Abu", state: "Rajasthan", region: "desert", lat: 24.5926, lng: 72.7156, cost: 2600, minD: 2, maxD: 4, tags: ["family", "elders"], hl: "Lakes, marble Jain temples, cool air." },
  { name: "Chittorgarh", state: "Rajasthan", region: "desert", lat: 24.8797, lng: 74.6295, cost: 2200, minD: 2, maxD: 3, tags: ["solo", "family"], hl: "The largest fort in India, echoing with legend." },
  { name: "Ajmer", state: "Rajasthan", region: "desert", lat: 26.4499, lng: 74.6399, cost: 2300, minD: 1, maxD: 2, tags: ["family", "elders"], hl: "The dargah and lakeside promenade." },
  { name: "Kumbhalgarh", state: "Rajasthan", region: "desert", lat: 25.1585, lng: 73.5914, cost: 2400, minD: 2, maxD: 3, tags: ["solo", "family"], hl: "The massive wall that runs across the Aravallis." },

  // ===== HIMALAYAS & NORTH EAST =====
  { name: "Rishikesh", state: "Uttarakhand", region: "himalaya", lat: 30.0869, lng: 78.2676, cost: 2800, minD: 3, maxD: 5, tags: ["solo"], hl: "Ganga-side yoga towns and river rafting." },
  { name: "Manali", state: "Himachal Pradesh", region: "himalaya", lat: 32.2432, lng: 77.1892, cost: 3200, minD: 5, maxD: 7, tags: ["solo", "family"], hl: "Snow passes and pine-forest valleys." },
  { name: "Shimla", state: "Himachal Pradesh", region: "himalaya", lat: 31.1048, lng: 77.1734, cost: 2900, minD: 4, maxD: 6, tags: ["family", "elders"], hl: "Colonial mall road and toy-train views." },
  { name: "Dharamshala", state: "Himachal Pradesh", region: "himalaya", lat: 32.2190, lng: 76.3234, cost: 2700, minD: 4, maxD: 6, tags: ["solo", "elders"], hl: "Monasteries beneath the Dhauladhar range." },
  { name: "Srinagar", state: "Jammu & Kashmir", region: "himalaya", lat: 34.0837, lng: 74.7973, cost: 4200, minD: 6, maxD: 9, tags: ["family", "elders"], hl: "Houseboats on Dal Lake and Mughal gardens." },
  { name: "Gulmarg", state: "Jammu & Kashmir", region: "himalaya", lat: 34.0484, lng: 74.3805, cost: 4000, minD: 6, maxD: 8, tags: ["family"], hl: "Gondola rides over meadows and snow." },
  { name: "Leh", state: "Ladakh", region: "himalaya", lat: 34.1526, lng: 77.5771, cost: 4500, minD: 7, maxD: 10, tags: ["solo"], hl: "High-altitude passes and monasteries." },
  { name: "Nainital", state: "Uttarakhand", region: "himalaya", lat: 29.3919, lng: 79.4542, cost: 2800, minD: 3, maxD: 5, tags: ["family", "elders"], hl: "Boating lake town ringed by forested peaks." },
  { name: "Mussorie", state: "Uttarakhand", region: "himalaya", lat: 30.4598, lng: 78.0644, cost: 2700, minD: 3, maxD: 5, tags: ["family", "elders"], hl: "The Queen of Hills with cloud-time viewpoints." },
  { name: "Auli", state: "Uttarakhand", region: "himalaya", lat: 30.5396, lng: 79.5686, cost: 3300, minD: 3, maxD: 5, tags: ["solo", "family"], hl: "Ski slopes and cable-car views of Nanda Devi." },
  { name: "Kasol", state: "Himachal Pradesh", region: "himalaya", lat: 32.0098, lng: 77.3149, cost: 2500, minD: 4, maxD: 6, tags: ["solo"], hl: "Israeli cafes in a carving Parvati valley." },
  { name: "Spiti Valley", state: "Himachal Pradesh", region: "himalaya", lat: 32.2481, lng: 78.0605, cost: 4000, minD: 7, maxD: 10, tags: ["solo"], hl: "Moonscape villages on the Tibetan plateau." },
  { name: "Darjeeling", state: "West Bengal", region: "himalaya", lat: 27.0410, lng: 88.2663, cost: 3300, minD: 5, maxD: 7, tags: ["family", "elders"], hl: "Tea gardens under a Kanchenjunga skyline." },
  { name: "Gangtok", state: "Sikkim", region: "himalaya", lat: 27.3389, lng: 88.6065, cost: 3500, minD: 5, maxD: 7, tags: ["family", "solo"], hl: "Cloud-fringed capital of Sikkim." },
  { name: "Shillong", state: "Meghalaya", region: "himalaya", lat: 25.5788, lng: 91.8933, cost: 3100, minD: 4, maxD: 6, tags: ["solo", "family"], hl: "Scotland of the East with living root bridges." },
  { name: "Kaziranga", state: "Assam", region: "himalaya", lat: 26.5780, lng: 93.1714, cost: 3200, minD: 3, maxD: 4, tags: ["family", "solo"], hl: "One-horned rhinos in tall elephant grass." },
  { name: "Tawang", state: "Arunachal Pradesh", region: "himalaya", lat: 27.5835, lng: 91.8605, cost: 3800, minD: 6, maxD: 8, tags: ["solo"], hl: "High-altitude monastery above the clouds." },
  { name: "Pelling", state: "Sikkim", region: "himalaya", lat: 27.2310, lng: 88.2254, cost: 3100, minD: 4, maxD: 6, tags: ["family", "elders"], hl: "Panoramic Kanchenjunga views from a quiet ridge." },
  { name: "Kausani", state: "Uttarakhand", region: "himalaya", lat: 29.8434, lng: 79.6030, cost: 2600, minD: 3, maxD: 4, tags: ["family", "elders"], hl: "A straight-line Himalayan panorama at sunrise." },
  { name: "Bir Billing", state: "Himachal Pradesh", region: "himalaya", lat: 32.0649, lng: 76.7295, cost: 2600, minD: 3, maxD: 5, tags: ["solo"], hl: "World-famous paragliding over tea gardens." },

  // ===== SOUTH =====
  { name: "Munnar", state: "Kerala", region: "south", lat: 10.0889, lng: 77.0595, cost: 3300, minD: 5, maxD: 7, tags: ["family", "elders"], hl: "Rolling tea estates and misty viewpoints." },
  { name: "Alleppey", state: "Kerala", region: "south", lat: 9.4981, lng: 76.3388, cost: 3600, minD: 5, maxD: 7, tags: ["family", "elders"], hl: "Slow houseboat cruises through the backwaters." },
  { name: "Coorg", state: "Karnataka", region: "south", lat: 12.3375, lng: 75.8069, cost: 2800, minD: 4, maxD: 6, tags: ["family"], hl: "Coffee plantations and waterfall treks." },
  { name: "Ooty", state: "Tamil Nadu", region: "south", lat: 11.4102, lng: 76.6950, cost: 2600, minD: 4, maxD: 6, tags: ["family", "elders"], hl: "Botanical gardens and a heritage toy train." },
  { name: "Hampi", state: "Karnataka", region: "south", lat: 15.3350, lng: 76.4600, cost: 2200, minD: 3, maxD: 4, tags: ["solo"], hl: "Boulder-strewn ruins of a former empire." },
  { name: "Gokarna", state: "Karnataka", region: "south", lat: 14.5479, lng: 74.3188, cost: 2400, minD: 3, maxD: 4, tags: ["solo"], hl: "Quiet cliffside beaches, fewer crowds than Goa." },
  { name: "Pondicherry", state: "Puducherry", region: "south", lat: 11.9416, lng: 79.8083, cost: 2800, minD: 3, maxD: 5, tags: ["solo", "family"], hl: "French-colonial lanes, beaches, and Auroville." },
  { name: "Mahabalipuram", state: "Tamil Nadu", region: "south", lat: 12.6269, lng: 80.1925, cost: 2400, minD: 2, maxD: 3, tags: ["family", "elders"], hl: "Shore temples carved from granite." },
  { name: "Kodaikanal", state: "Tamil Nadu", region: "south", lat: 10.2381, lng: 77.4892, cost: 2700, minD: 4, maxD: 6, tags: ["family", "elders"], hl: "Star-shaped lake and pine-lined walking trails." },
  { name: "Wayanad", state: "Kerala", region: "south", lat: 11.6854, lng: 76.1320, cost: 3000, minD: 4, maxD: 6, tags: ["family", "solo"], hl: "Caves, waterfalls, and spice-forest resorts." },
  { name: "Kovalam", state: "Kerala", region: "south", lat: 8.4003, lng: 76.9786, cost: 3200, minD: 4, maxD: 6, tags: ["family", "elders"], hl: "Crescent beaches and lighthouse sunset views." },
  { name: "Kabini", state: "Karnataka", region: "south", lat: 11.9754, lng: 76.2874, cost: 3500, minD: 3, maxD: 4, tags: ["solo", "family"], hl: "River-front wildlife safaris in comfort." },
  { name: "Chikmagalur", state: "Karnataka", region: "south", lat: 13.3161, lng: 75.7720, cost: 3000, minD: 4, maxD: 6, tags: ["solo", "family"], hl: "Coffee-air hill town where the Sahyadris begin." },
  { name: "Yercaud", state: "Tamil Nadu", region: "south", lat: 11.7814, lng: 78.2086, cost: 2500, minD: 3, maxD: 4, tags: ["family", "elders"], hl: "Orchard-covered hills beside an emerald lake." },
  { name: "Kanyakumari", state: "Tamil Nadu", region: "south", lat: 8.0883, lng: 77.5385, cost: 2300, minD: 3, maxD: 4, tags: ["family", "elders"], hl: "Where three oceans meet at the southern tip." },
  { name: "Rameswaram", state: "Tamil Nadu", region: "south", lat: 9.2876, lng: 79.3129, cost: 2400, minD: 2, maxD: 3, tags: ["family", "elders"], hl: "Temple corridors and radiant coral beaches." },
  { name: "Valparai", state: "Tamil Nadu", region: "south", lat: 10.3271, lng: 76.9553, cost: 2600, minD: 3, maxD: 5, tags: ["solo", "family"], hl: "A quiet tea estate plateau on switchback roads." },
  { name: "Araku Valley", state: "Andhra Pradesh", region: "south", lat: 18.3321, lng: 82.8686, cost: 2500, minD: 3, maxD: 4, tags: ["family", "elders"], hl: "Waterfall valley reached by mountain railway." },
  { name: "Lepakshi", state: "Andhra Pradesh", region: "south", lat: 13.8020, lng: 77.6080, cost: 1800, minD: 1, maxD: 2, tags: ["solo", "elders"], hl: "Hanging pillar temple and giant frescoes." },
  { name: "Gandikota", state: "Andhra Pradesh", region: "south", lat: 14.8133, lng: 78.2826, cost: 2200, minD: 2, maxD: 3, tags: ["solo"], hl: "The Grand Canyon of India beside a fort." },
  { name: "Bekal", state: "Kerala", region: "south", lat: 12.3950, lng: 75.0333, cost: 2900, minD: 3, maxD: 5, tags: ["solo", "family"], hl: "A seaside fort above a stretch of quiet golden sand." },
  { name: "Varkala", state: "Kerala", region: "south", lat: 8.7301, lng: 76.7112, cost: 2800, minD: 3, maxD: 5, tags: ["solo"], hl: "Clifftop cafés over a mineral-rich beach." },

  // ===== EAST & ISLANDS =====
  { name: "Port Blair", state: "Andaman & Nicobar", region: "east", lat: 11.6234, lng: 92.7265, cost: 5500, minD: 6, maxD: 9, tags: ["family", "solo"], hl: "Coral reefs and colonial-era history." },
  { name: "Havelock", state: "Andaman & Nicobar", region: "east", lat: 11.9669, lng: 93.0018, cost: 6000, minD: 5, maxD: 8, tags: ["family", "solo"], hl: "Powder-white Radhanagar beach and diving." },
  { name: "Puri", state: "Odisha", region: "east", lat: 19.8135, lng: 85.8312, cost: 2500, minD: 3, maxD: 5, tags: ["family", "elders"], hl: "Sacred seafront town with a golden beach." },
  { name: "Konark", state: "Odisha", region: "east", lat: 19.8876, lng: 86.0945, cost: 2200, minD: 2, maxD: 3, tags: ["family", "elders"], hl: "Sun temple war chariot of carved stone." },
  { name: "Digha", state: "West Bengal", region: "east", lat: 21.6261, lng: 87.5067, cost: 2200, minD: 2, maxD: 3, tags: ["family", "elders"], hl: "The closest beach getaway from Kolkata." },
  { name: "Sundarbans", state: "West Bengal", region: "east", lat: 21.9497, lng: 88.9365, cost: 2800, minD: 3, maxD: 5, tags: ["solo", "family"], hl: "Mangrove forests and the royal Bengal tiger." },
  { name: "Agartala", state: "Tripura", region: "east", lat: 23.8315, lng: 91.2868, cost: 2800, minD: 3, maxD: 5, tags: ["solo", "family"], hl: "Riverside palaces and temple-laced bazaars." },
  { name: "Kohima", state: "Nagaland", region: "east", lat: 25.6564, lng: 94.1063, cost: 3200, minD: 4, maxD: 6, tags: ["solo"], hl: "War cemetery, Naga villages, and Hornbill spirit." },
  { name: "Imphal", state: "Manipur", region: "east", lat: 24.8170, lng: 93.9368, cost: 3000, minD: 3, maxD: 5, tags: ["solo", "family"], hl: "Loktak lake's floating islands of phumdi." },
  { name: "Majuli", state: "Assam", region: "east", lat: 26.9496, lng: 94.1680, cost: 2600, minD: 3, maxD: 5, tags: ["solo"], hl: "The world's largest river island." }
];

module.exports = { CITIES, REGIONS, DESTINATIONS };
