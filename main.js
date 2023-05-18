let FILE_PATH = "highPollution.csv";
let MAP_PATH = "taiwan.json";

let scatX = 0, scatY = 0;
let scatTotalWidth = 600, scatTotalHeight = 400;
let scatMargin = {top:10, right:30, bottom: 30, left:100},
    scatWidth = scatTotalWidth - scatMargin.left - scatMargin.right,
    scatHeight = scatTotalHeight - scatMargin.top - scatMargin.bottom;

let lineX = 0, lineY = 400;
let lineTotalWidth = 600, lineTotalHeight = 200;
let lineMargin = {top:10, right:30, bottom: 40, left:100},
    lineWidth = lineTotalWidth - lineMargin.left - lineMargin.right,
    lineHeight = lineTotalHeight - lineMargin.top - lineMargin.bottom;

let barX= 0, barY = 600;
let barTotalWidth = 1000, barTotalHeight = 150;
let barMargin = {top:30, right:30, bottom: 60, left:100},
    barWidth = barTotalWidth - barMargin.left - barMargin.right,
    barHeight = barTotalHeight - barMargin.top - barMargin.bottom;

let mapX = 600, mapY = 0;
let mapTotalWidth = 800, mapTotalHeight = 800;
let mapMargin = {top:10, right:10, bottom: 10, left:10},
    mapWidth = mapTotalWidth - mapMargin.left - mapMargin.right,
    mapHeight = mapTotalHeight - mapMargin.top - mapMargin.bottom;

const SVG_WIDTH = scatTotalWidth + mapTotalWidth
const SVG_HEIGHT = (scatTotalHeight + lineTotalHeight + barTotalHeight)
// declare this global var for being available to any subsequent functions outside of d3.csv()
let dataset;
let barData=[]; // data for plotting barchart
let mapData = []; // global var for adding record site on the map

let minValue = Infinity, maxValue = 0; // for color scaling
let min_umapX = Infinity, max_umapX = 0; // for x-scaling of scatter plot
let min_umapY = Infinity, max_umapY = 0; // for y-scaling of scatter plot
let min_valueY = Infinity, max_valueY = 0; // for y-scaling of line plot
let minHr = Infinity, maxHr = 0; // for y-scaling of bar plot

// Marks on map as d3 path constant
const customed_fig = "m 0 0 l -5 -10 c 5 -10 5 9 10 0 l -5 10";
// convert string array to float array
function strArr2Value(str_arr){
    let value_arr = str_arr.match(/\d+(?:\.\d+)?/g).map(Number);
    return value_arr;
}

function MergeTwo1D_array(arr1, arr2){
    if(arr1.length != arr2.length){
        return false;
    }
    let res = [];
    for(let i=0; i< arr1.length; i++){
        res.push([arr1[i], arr2[i]]);
    }
    return res;
}

function Assign_minMax(d){ // iter d-data object to find min-max value
    // append lon, lat for map
    mapData.push([d.gps_lon, d.gps_lat]); // sub-data for map plot
    // find min-max value for y-scale of line plot
    if(d3.min(d.value) < min_valueY){
        min_valueY = d3.min(d.value);
    }
    if(d3.max(d.value) > max_valueY){
        max_valueY = d3.max(d.value);
    }
}

// check if the str:day, hour is in the array
function Is_in_arr(day, hour, array){ 
    // array = [{"day", "hour", counts}]
    res = [false, -1] // boolean, index
    for(let i=0; i<array.length;i++){
        if(day === array[i].day && hour === array[i].hour){
            res[0] = true;
            res[1] = i;
            return res;
        }
    }
    return res;
}

// Convert a float array into assigned number of digits in decimals
function ConvertDecimal(array, number_of_decimal){
    let output_arr = [];
    for(let i=0;i<array.length;i++){
        output_arr.push(array[i].toFixed(number_of_decimal));
    }
    return output_arr;
}

// conver string to value whlie reading every data record
function rowConvert(d){
    let value_arr = strArr2Value(d.value);
    let mean_value = d3.mean(value_arr);
    d["mean_value"] = mean_value; // add mean value of PM2.5 into each object
    return{
        siteID: d.siteID,
        day: d.day,
        hour: d.hour,
        year: d.year,
        month: d.month,
        weekday: d.weekday,
        gps_lat: parseFloat(d.gps_lat),
        gps_lon: parseFloat(d.gps_lon),
        value: value_arr,
        mean_value: d.mean_value,
        umapX: parseFloat(d.umapX),
        umapY: parseFloat(d.umapY)
    };
}

function Filter_Bardata(barData, condition_array){
    // array structure: [attr{day, hour, count}]
    // use map function to return a new array, avoid changing the original array
    let filtered_bar_data = barData.map(function(value, index, array){
        for(let i=0; i<condition_array.length; i++){
            let is_selected = condition_array[i].day===value.day &&
                              condition_array[i].hour===value.hour;
            if(is_selected){ // filtered and give counts
                return { day:value.day,
                         hour:value.hour,
                         count:condition_array[i].count};
            }
        }
        // filtered out data counted as 0 (not selected)
        return {day:value.day,
                hour:value.hour,
                count:0};
    });
    return filtered_bar_data;
}
function Count4BarData(row_data, result_array){
    let search_res_of_bar = Is_in_arr(row_data.day, row_data.hour, result_array); // return [bool, index]
    if(search_res_of_bar[0]){ // found
        let i = search_res_of_bar[1];
        result_array[i].count ++;
    }
    else{ // not found, append one set
        result_array.push({day: row_data.day,
                           hour: row_data.hour,
                           count: 1});
    }
}

function Search_GPS_by_Day_Hour(day_hour_array, dataset){
    // day_hour_array = [attribute{day, hour},...]
    let gps_res = [];
    for(let i=0;i<day_hour_array.length;i++){
        // search gps pos iteratively by day_hour_array element
        dataset.map(function(value, index, array){
            if(value.day === day_hour_array[i].day &&
               value.hour === day_hour_array[i].hour){
                   gps_res.push({ gps_lon:value.gps_lon,
                                  gps_lat:value.gps_lat });
            }
        });
    }
    return gps_res;
}

// append SVG which contains the four charts
const SVG = d3.select("#chart-area").append("svg")
              .attr("width", SVG_WIDTH)
              .attr("height", SVG_HEIGHT);

d3.csv(FILE_PATH, rowConvert).then(data => {
    //console.table(data);
    dataset = data;
    // console.table(dataset);

    data.forEach(d => {
        Assign_minMax(d); // assign min-max value to min-max var for plotting

        // bar data handling
        Count4BarData(d, barData);
    });

//============================ scatter plot =================================
    const R = 1.5 // radius of circles

    let scatG = SVG.append("g") // scat = scat_area + scat_axes
                   .attr("id", "scatter-plot")
                   .attr("width", scatTotalWidth)
                   .attr("height", scatTotalHeight)
                   .attr("transform",
                         "translate("+ scatX + "," + scatY + ")");
    /*
        In order to enable both tooltip and brush, the DOM structure of them should be
        arranged as sibling groups, at the same level of scattered points
    */ 
    // the var declaration is necessary for following calling of brush and tooltips!
    let brush_area = scatG.append("g")
    let tooltipg = scatG.append("g")
    // create colormap scaler
    let scatColorValue = d3.scaleSequential()
                           .domain([d3.min(data, d=>d.mean_value), d3.max(data, d=>d.mean_value)])
                           .interpolator(d3.interpolateReds);
    // create x-axis scaler obj
    scatXScaler = d3.scaleLinear()
                    .domain([d3.min(data, d=>d.umapX), d3.max(data, d=>d.umapX)])
                    .range([scatMargin.left, scatTotalWidth-scatMargin.right]);
    // create y-axis scaler obj
    scatYScaler = d3.scaleLinear()
                    .domain([d3.min(data, d=>d.umapY), d3.max(data, d=>d.umapY)])
                    .range([scatTotalHeight-scatMargin.bottom, scatMargin.top]);
    // x-axis
    let scatXaxis = d3.axisBottom(scatXScaler)
                      .tickFormat(""); // disable scale value
    scatG.append("g") // put x-axis
         .attr("transform",
               "translate(0" + ","+ (scatTotalHeight-scatMargin.bottom)+ ")")
         .call(scatXaxis);
    // y-axis
    let scatYaxis = d3.axisLeft(scatYScaler)
                      .tickFormat(""); // disable scale value
    scatG.append("g") // put y-axis
         .attr("transform",
               "translate("+ scatMargin.left + ",0)")
         .call(scatYaxis);

    // create points by iterating data items
    let scat_area = scatG.append("g") // bind data to circles
    let scat_points = scat_area.selectAll("circle")
                               .data(data).enter().append("circle")
                               .attr("cx", d => scatXScaler(d.umapX))
                               .attr("cy", d => scatYScaler(d.umapY))
                               .attr("r", R)
                               .attr("fill", function(d, row){
                                    return scatColorValue(d.mean_value);
                               });


//============================ Line Plot =================================
    lineXScaler = d3.scaleLinear()
                    .domain([1, 7])
                    .range([lineMargin.left, lineTotalWidth-lineMargin.right]);

    // create y-axis scaler obj
    lineYScaler = d3.scaleLinear()
                    .domain([min_valueY, max_valueY])
                    .range([lineTotalHeight-lineMargin.bottom, lineMargin.top]);

    // append line plot graph area
    // generate path data for drawing the lines
    let lineG = SVG.append("g")
                   .attr("id", "line-chart")
                   .attr("width", lineTotalWidth)
                   .attr("height", lineTotalHeight)
                   .attr("transform",
                         "translate(" + lineX + "," + lineY + ")" );
    let lineGenerator = d3.line()
                          .x(function(d){
                                return lineXScaler(d[0])
                            })
                          .y(function(d){
                                return lineYScaler(d[1])
                            });
    // x-axis
    let lineXaxis = d3.axisBottom(lineXScaler)
                      .tickValues([1,2,3,4,5,6,7]) // directly assign value of x-axis
                      .tickFormat(d3.format("d")); // format as integer
    lineG.append("g")
         .attr("transform",
               "translate(0"+","+ (lineTotalHeight-lineMargin.bottom)+ ")")
         .call(lineXaxis);
    // x label
    lineG.append("text")
         .attr("x", lineMargin.left + lineWidth/2)
         .attr("y", lineTotalHeight - 5)
         .attr("font-size", "14px")
         .attr("text-anchor","middle")
         .text("Local Time (hour)");
    // y-axis
    let lineYaxis = d3.axisLeft(lineYScaler);
    lineG.append("g")
         .attr("transform",
               "translate("+ (lineMargin.left)+ ",0)")
         .call(lineYaxis);
    // y label
    lineG.append("text")
    // x,y direction is changed due to the rotate
         .attr("x",-lineTotalHeight/2+lineMargin.bottom/2)
         .attr("y", lineMargin.left/2)
         .attr("font-size", "14px")
         .attr("text-anchor","middle")
         .attr("transform", "rotate(-90)")
         .text("PM 2.5");
    let lines = lineG.append("g").attr("id","lines");
    // draw the line iteratively (by each row)
    function Draw_line(data){
        // init lines as empty
        lines.html("");
        for(let i=0;i<data.length;i++){
            let line_path_arr = MergeTwo1D_array([1,2,3,4,5,6,7], data[i].value);
            lines.append("path")
                .attr("d", lineGenerator(line_path_arr))
                .attr("fill", "none")
                .attr("stroke", "black")
                .attr("stroke-opacity", 0.1)
                .attr("stroke-width", 1);
        }
    }
    Draw_line(data);
    // d3.select("#lines").html(""); // empty the content
// ========================-==== barchart ======================================
    // sort barData by day-hour in element[0] in the type of string
    barData.sort((a, b) => {
        return a.day - b.day || a.hour - b.hour; // primary sort day; secondary, hour
    });
    let day_hour = barData.map(d => d.day + "-" + d.hour); // return day-hour string
    // console.table(barData);
    function Every2_Slice(arr, n){
        let res = [];
        for(let i = n-1; i < arr.length; i += n){
           res.push(arr.splice(i, 1)[0]);
           // console.log(arr.splice(i, 1));
        };
        return res;
    };
    let day_hour_every2 = Every2_Slice(day_hour,2);
    // console.log(day_hour_every2);
    // console.table(barData);
    // console.log(day_hour);
    let barG = SVG.append("g")
                  .attr("id", "bar-chart")
                  .attr("width", barTotalWidth)
                  .attr("height", barTotalHeight)
                  .attr("transform",
                        "translate(" + barX + "," + barY + ")");
    let bar_brushX = barG.append("g"); // group declaration for brushX in bar-chart
    // create colormap scaler for hours
    let colorRec = d3.scaleSequential()
                     .domain([d3.min(barData, d=>d.hour), d3.max(barData, d=>d.hour)])
                     .interpolator(d3.interpolateBuGn);
    // create band scale object, x-scaler
    let bandScale = d3.scaleBand()
                      .domain(barData.map(d => d.day + "-" + d.hour))
                      .range([0, barWidth])
                      .paddingOuter(0.5)
                      .paddingInner(0.4);

    // x-axis
    // console.log(barData);
    let barXaxis = d3.axisBottom(bandScale)
                     .tickValues(day_hour_every2);
    barG.append("g")
        .attr("transform",
              "translate("+ (barMargin.left)+ ","+ (barTotalHeight-barMargin.bottom)+ ")")
        .call(barXaxis)
            .selectAll("text")
            .attr("font-size","10px")
            .attr("x", "-10")
            .attr("y", "-0")
            .attr("text-anchor", "end")
            .attr("transform","rotate(-60)");
    // x label
    barG.append("text")
        .attr("x", barMargin.left + barWidth/2)
        .attr("y", barTotalHeight-10)
        .attr("font-size", "14px")
        .attr("text-anchor","middle")
        .text("Time (day-hour)");

    // y-axis
    let barYaxisG = barG.append("g"); // var declaration of y-axis group
    // create y-axis scaler obj
    let barYScaler = d3.scaleLinear()
                       .domain([0, d3.max(barData, d=>d.count)])
                       .range([barTotalHeight-barMargin.bottom, barMargin.top]);
    // Draw the left y-axis
    function Draw_BarY(barData){
        // initialize the barY axis
        barYaxisG.html("");

        barYScaler = d3.scaleLinear()
                       .domain([0, d3.max(barData, d=>d.count)])
                       .range([barTotalHeight-barMargin.bottom, barMargin.top]);
        // create y-axis object
        let barYaxis = d3.axisLeft(barYScaler)
                         .ticks(7); // set number of ticks
        barYaxisG.attr("transform",
                       "translate("+ (barMargin.left) + "," + "0)")
                 .call(barYaxis);
    }
    Draw_BarY(barData);

    // y label
    barG.append("text")
        // x,y direction is changed due to the rotate
        .attr("x",-barTotalHeight/2+barMargin.bottom/2-15)
        .attr("y", barMargin.left/2)
        .attr("font-size", "14px")
        .attr("text-anchor","middle")
        .attr("transform", "rotate(-90)")
        .text("Record Counts");
    // draw bars
    let bars = barG.append("g");
    let bar_rects = bars.selectAll("rect")
                        .data(barData) // bind data
                        .enter().append("rect") // add rects = # data rows
                        .attr("x", function(d){
                            return barMargin.left + bandScale(d.day+"-"+d.hour);
                        })
                        .attr("y", d => barYScaler(d.count))
                        .attr("height", d => barTotalHeight-barMargin.bottom-barYScaler(d.count))
                        .attr("width", 4.5)
                        .attr("fill", function(d){
                            return colorRec(d.hour);
                        })
                        .attr("opacity", 1)
                        .attr("stroke", "black")
                        .attr("stroke-width", 1);

    function Draw_Bar(barData, Scaler=barYScaler){
        // initialize
        bars.html("");
        bars.selectAll("rect")
            .data(barData) // bind data
            .enter().append("rect") // add rects = # data rows
            .attr("x", function(d){
                return barMargin.left + bandScale(d.day+"-"+d.hour);
            })
            .attr("y", d => Scaler(d.count))
            .attr("height", d => barTotalHeight-barMargin.bottom-Scaler(d.count))
            .attr("width", 4.5)
            .attr("fill", function(d){
                return colorRec(d.hour);
            })
            .attr("opacity", 1)
            .attr("stroke", "black")
            .attr("stroke-width", 1);
    }


    //=============================== The Map chart Part ==================================
    // define the projection object
    let projection = d3.geoEquirectangular();
    // append map graph
    let mapG = SVG.append("g").attr("id", "map")
                  .attr("width", mapTotalWidth)
                  .attr("height", mapTotalHeight)
                  .attr("transform",
                      "translate(" + mapX + "," + mapY + ")");
    let map_taiwan = mapG.append("g"); // group for geography of taiwan
    let map_county_names = mapG.append("g"); // group for texts of county names
    let map_mark = mapG.append("g"); // group for customized marks.

    
    function DrawTaiwan(taiwan){
        // console.table(data);
        // console.log(taiwan);

        // define the projection extent
        projection.fitExtent([[0,0], [mapTotalWidth, mapTotalHeight]], taiwan);

        let geoGenerator = d3.geoPath()
                            .projection(projection);

        // draw the map by paths
        map_taiwan.selectAll("path")
                .data(taiwan.features)
                .enter()
                .append("path")
                .attr("stroke", "black")
                .attr("fill", "lightgreen")
                // each item in taiwan.features will be as input into geoGenerator
                // and generate path descriptor.
                .attr("d", geoGenerator);
        // add county names texts
        map_county_names.selectAll("text")
                        .data(taiwan.features)
                        .enter()
                        .append("text")
                        .attr("text-anchor", "middle")
                        .attr("alignment-baseline", "middle")
                        .attr("opacity", 0.5)
                        .text(function(d){
                                return d.properties.NAME_2014;
                            })
                        .attr("transform", function(d){ // anchor text at the mid of counties
                                let centre = geoGenerator.centroid(d);
                                return "translate(" + centre + ")";
                            });

        // draw the customed figures
        // https://mavo.io/demos/svgpath/
        // const customed_fig = "m 0 0 l -5 -10 c 5 -10 5 9 10 0 l -5 10";
        Draw_Mark_on_Map(map_mark, data);
    }
    function Draw_Mark_on_Map(mark_g, mark_loc_data){ // mark_g: appended from mapG for mark-groups
        // initialize marks group
        mark_g.html("");
        // draw marks
        mark_g.selectAll("path")
                .data(mark_loc_data)
                .enter()
                .append("path")
                .attr("stroke", "black")
                .attr("stroke-width", 0.5)
                .attr("fill", "red")
                .attr("d", customed_fig) //draw then do the translation
                .attr("transform", function(d){
                        // console.log(d.gps_lat);
                        let lon = projection([d.gps_lon, d.gps_lat])[0]; // longitude -> graph x-pos
                        let lat = projection([d.gps_lon, d.gps_lat])[1]; // latitude -> graph y-pos
                        return("translate(" + lon + "," + lat + ")");
                    });
    }
    d3.json(MAP_PATH).then(DrawTaiwan);
//============================ Interaction Part ================================
    // pop-out small window interaction
    // init the popout window
    let tip = d3.tip().attr("class", "d3-tip") // assign class name
                // content of tooltip, 'd' is data item sent to tooltip.
                .html(d => ("Day: "+ d.day +"<br/>"
                            +"Hour: "+ d.hour +"<br/>"
                            +"PM2.5 = "+ ConvertDecimal(d.value,0)));

    tooltipg.call(tip); // enable tooltip in scatter graph
    // event listener
    scat_points.on("mouseover", tip.show)
               .on("mouseout", tip.hide);

    // brush(selected) interaction
    // init the brushing area and add event listener
    let brush = d3.brush()
                  .extent([[scatMargin.left/2,0],
                           [scatTotalWidth, scatTotalHeight]]) // brushable area
                  .on("start", ScatBrushed)
                  .on("brush", ScatBrushed)
                  .on("end", ScatBrushEnd);
    brush_area.call(brush);

    let filtered_data = []; // save all selected data
    let updated_line_data = []; // append for line-chart data: only d.value
    let updated_bar_data = []; // append for bar-chart data: d.day, d.hour
    let updated_map_data = []; // append for bar-chart data: d.day, d.hour

    //=============== scatter brush listener functions ====================
    function ScatBrushed(){
        // console.log(event);
        // get the selected area position in pixel-wise.
        let extent = d3.event.selection; // top-left and down-right
        // assign style:selected with selected circles.
        // console.log(extent); // 2*2 array of the pos of top-left and bottom-right
        // update scatter plot
        let selected_data = [];
        let selected_line_data = [];
        let selected_bar_data = [];
        let filtered_bar_data;
        let selected_map_data = [];
        scat_points.classed("selected_point", function(d){
            // check if the points are in the selected area
            let is_selected = scatXScaler(d.umapX) >= extent[0][0] && 
                              scatXScaler(d.umapX) <= extent[1][0] && 
                              scatYScaler(d.umapY) >= extent[0][1] && 
                              scatYScaler(d.umapY) <= extent[1][1];
            if(is_selected){
                // append filtered data
                selected_data.push(d);
                // one selected point = one line
                selected_line_data.push(d.value);
                selected_map_data.push({gps_lon:d.gps_lon,
                                        gps_lat:d.gps_lat });
                Count4BarData(d, selected_bar_data); // not-selected ones' count = 0
            }
            return is_selected; // boolean
        })
        filtered_data = selected_data;
        updated_line_data = selected_line_data;
        updated_bar_data = selected_bar_data;
        updated_map_data = selected_map_data;
        // console.log(updated_map_data);
        // console.table(filtered_data);
        // console.log(updated_line_data.length);
        //=========== Update line-chart =============
        // console.log(selected_line_data);
        // console.log(selected_line_data.length);
        // draw the line iteratively (by each row)
        if(updated_line_data.length !=0){
            // initialize line paths
            lines.html("");
            // draw lines according to the selected points
            for(let i=0;i<updated_line_data.length;i++){
                let line_path_arr = MergeTwo1D_array([1,2,3,4,5,6,7], updated_line_data[i]);
                lines.append("path")
                    .attr("d", lineGenerator(line_path_arr))
                    .attr("fill", "none")
                    .attr("stroke", "black")
                    .attr("stroke-opacity", 0.1)
                    .attr("stroke-width", 1);
            }
        };
    }
    // brush end function
    function ScatBrushEnd(){
        // console.log(updated_line_data.length);
        if(updated_line_data.length == 0){
            // console.log("Recover the lines.")
            Draw_line(data);
        }
        if(updated_bar_data.length == 0){
            // console.log("Recover the barchart.")
            Draw_Bar(barData);
            // redraw the barYaxis
            Draw_BarY(barData);
        }else{
            //========= Update bar-chart ===========
            //console.log(selected_bar_data);
            //console.log(selected_bar_data.length);

            // same size with barData and it's already sorted by ascending order.
            filtered_bar_data = Filter_Bardata(barData, updated_bar_data); 
            // console.table(updated_bar_data);
            // console.table(filtered_bar_data);
            //========= update y-axis ===========
            // create y-axis scaler obj
            const tranition_t = d3.transition().delay(100).duration(1000);
            let updated_barYScaler = d3.scaleLinear()
                                      .domain([0, d3.max(filtered_bar_data, d=>d.count)])
                                      .range([barTotalHeight-barMargin.bottom, barMargin.top]);
            // create new y-axis object
            let updated_barYaxis = d3.axisLeft(updated_barYScaler)
                                     .ticks(6);
            // draw bar-chart according to the selected points
            // Draw_Bar(updated_bar_data, updated_barYScaler);
            // console.log(update_bar_rects);

            // update and animated the new y-axis
            barYaxisG.transition(tranition_t).call(updated_barYaxis);
            // bind new dataset to the rectangles.
            bars.selectAll("rect").data(filtered_bar_data)
                .transition(tranition_t) // animated
                    .attr("y", d => updated_barYScaler(d.count))
                    .attr("height", d => barTotalHeight-barMargin.bottom-updated_barYScaler(d.count));

        }
        if(updated_map_data.length == 0){
            // reset the marks on map
            Draw_Mark_on_Map(map_mark, data);
        }else{
            // Update the marks on the map
            // console.log(updated_map_data.length);
            // console.log(updated_map_data[0].gps_lon);
            Draw_Mark_on_Map(map_mark, updated_map_data);
        }
    }
    // ============================= bar-chart brushX ================================
    // brush(selected) interaction
    // init the brushing area and add event listener
    let bar_brush = d3.brushX()
                      .extent([[barMargin.left/2, 10],
                               [barTotalWidth-barMargin.right/2, barTotalHeight-barMargin.bottom]]) // brushable area
                      .on("start", BarBrushed)
                      .on("brush", BarBrushed)
                      .on("end", BarBrushEnd);
    bar_brushX.call(bar_brush);


    let updated_map_data2 = []; // append for secondary filtered bar data

    function BarBrushed(){
        let extent = d3.event.selection; // [left-x , right-x]
        let selected_day_hour_from_bar = []; // temp store pos of bars
        // Notice we should select updated bars (rectangles)
        bars.selectAll("rect").classed("selected_bar", function(d){ 
            // check if the points are in the selected area
            // console.log(extent);
            // console.table(d); // d is still the old data, not filtered one.
            let is_selected = false;
            is_selected = extent[0] <= (barMargin.left + bandScale(d.day+"-"+d.hour)) &&
                          // 4.5 is the bar-rectangle-width
                          extent[1] >= (barMargin.left + bandScale(d.day+"-"+d.hour) + 4.5) && 
                          (d.count > 0);
            // console.log(is_selected);
            if(is_selected){
                // console.log(d);
                selected_day_hour_from_bar.push({day:d.day,
                                                 hour:d.hour });
            }
            return is_selected; // boolean
        })
        if(filtered_data.length!=0){
            // if brush scatter plot then brushX the bar-chart
            updated_map_data2 = Search_GPS_by_Day_Hour(selected_day_hour_from_bar, filtered_data);
        }else{
            // if directly brushX the bar-chart
            updated_map_data2 = Search_GPS_by_Day_Hour(selected_day_hour_from_bar, data);
        }
        
    }

    function BarBrushEnd(){
        // brushX (maybe secondary) filter on bar-charts
        if(updated_map_data2.length == 0 && updated_map_data.length == 0){
            // reset the marks on map (whole)
            Draw_Mark_on_Map(map_mark, data);
        }
        if(updated_map_data2.length == 0 && updated_map_data.length != 0){
            // reset the marks on map (first filtered stage)
            Draw_Mark_on_Map(map_mark, updated_map_data);
        }
        if(updated_map_data2.length != 0){
            // Update the marks on the map
            // console.log(updated_map_data2.length);
            // console.log(updated_map_data2);
            // console.log(updated_map_data2[0].gps_lon);
            Draw_Mark_on_Map(map_mark, updated_map_data2);
        }
    }
}).catch(function(error){ // raise if file loading fails
    console.log(error);
});


