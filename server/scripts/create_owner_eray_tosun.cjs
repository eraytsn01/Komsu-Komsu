const { storage } = require("../storage");

async function main() {
  const user = {
    firstName: "Eray",
    lastName: "TOSUN",
    email: "eray.tsn@gmail.com",
    phone: "+90 5340119800",
    avatarUrl: null,
    isAdmin: true,
    isApproved: true,
    buildingId: undefined,
    locationCode: "Aksaray|Merkez|Yunus Emre Mahallesi|street|7083 Sokak|11|5",
    doorNo: "11",
    innerDoorNo: "5",
    password: "12345678"
  };
  let building = await storage.getBuildingByLocationCode(user.locationCode);
  if (!building) {
    building = await storage.createBuilding({
      locationCode: user.locationCode,
      addressDetails: "Aksaray / Merkez / Yunus Emre Mahallesi / 7083 Sokak No:11 İç Kapı:5"
    });
  }
  user.buildingId = building.id;
  await storage.createUser(user.email, user);
  console.log("Eray TOSUN owner hesabı oluşturuldu.");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
