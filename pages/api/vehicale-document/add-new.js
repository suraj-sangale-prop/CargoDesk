import { addNewVehicleDocumentController } from "@/backend/controllers/vehicleDocumentController";
import { getAuthUserFromReq } from "@/utilities/authServer";

export default function handler(req, res) {
  return new Promise((resolve) => {
    const request = req.body;
    // 1. Directly extract verified user session from request cookie
    const authUser = getAuthUserFromReq(req);

    addNewVehicleDocumentController(request, authUser)
      .then((result) => {
        res.status(200).json(result);
        resolve(result);
      })
      .catch((error) => {
        res.status(500).json({ status: false, error: error?.message });
        resolve();
      });
  });
}