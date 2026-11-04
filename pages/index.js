import Head from "next/head";
import Dashboard from "@/components/dashboard";
import { withUserSsr } from "@/utilities/withUserSsr";
import { getAllVehicleDocumentsController } from "@/backend/controllers/vehicleDocumentController";

export default function Home({ pageData }) {
  return (
    <div>
      <Head>
        <title>My Dashboard | CargoDesk</title>
        <meta
          name="description"
          content="CargoDesk logistics and fleet management dashboard"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Dashboard pageData={pageData} />
    </div>
  );
}

export const getServerSideProps = withUserSsr(async (context, { user }) => {
  if (user?.role === "maintenance_supervisor") {
    return {
      redirect: {
        destination: "/maintenance-supervisor",
        permanent: false,
      },
    };
  }

  const pageData = { user };
  pageData.documentsList = [];
  const documentsResponse = await getAllVehicleDocumentsController(user);
  if (documentsResponse?.data && documentsResponse?.status == true) {
    pageData.documentsList = documentsResponse?.data;
  }

  return { props: { pageData } };
});
