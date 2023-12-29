[4:30 pm, 22/06/2022] Nithin Padikal: public function store(Request $request)
    {
        // logger('hai dis is nithin');
        if($request->hasFile('file'))
        {
            // Get the file
            $file = $request->file('file');

            // Check the file extension
            if($file->getClientOriginalExtension() != 'csv')
            {
                return redirect('price_config')->with('error','Please upload only csv ');
            }

            $location = 'uploads';
            $filename = $file->getClientOriginalName();

            // Upload file
            $file->move($location, $filename);
            // In case the uploaded file path is to be stored in the database
            $filepath = public_path($location . "/" . $filename);

            $importData_arr = array(); // Read through the file and store the contents as an array

            // Reading file
            // $file = fopen($filepath, "r");

            if (($open = fopen($filepath, "r")) !== FALSE)
            {
                while (($data = fgetcsv($open, 1000, ",")) !== FALSE)
                {
                    $importData_arr[] = $data;
                }
                    fclose($open);
            }

            foreach ($importData_arr as $prices) {

                $width = $prices[0];
                //$height = $prices[0]+100;
                $arr = array_slice($prices,1)

                foreach ($arr as $key=>$price)
                {
                    $height = 600 + $key*100
                    PriceConfiguration::create([
                        'vendor_id' => 1,
                        'product_id' => 2,
                        'width' => $width,
                        'height' => $height,
                        'price' => $price,
                        'status' => 1
                    ]);
                }
            }

        return redirect('price_config')->with('success','Added successfully ');
        }
    }