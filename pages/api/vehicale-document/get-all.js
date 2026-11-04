import { getAllVehicleDocumentsController } from "@/backend/controllers/vehicleDocumentController";
import { getAuthUserFromReq } from "@/utilities/authServer";

export default function handler(req, res) {
  return new Promise((resolve, reject) => {
    const request = req.body;
    const response = {
      status: false,
    };
     const authUser = getAuthUserFromReq(req);
    

    getAllVehicleDocumentsController(request, authUser)
      .then((result) => {
        res.status(200).json(result);
        resolve(result);
      })
      .catch((error) => {
        response.error = error;
        res.status(200).json(response);
        resolve();
      });
  });
}
