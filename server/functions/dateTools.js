export function dateTime() {

    const currentdate = new Date();

    const datetime = ((currentdate.getDate() > 9) ? (currentdate.getDate()) : ("0" + currentdate.getDate())) + "/"
        + ((currentdate.getMonth() > 8) ? (currentdate.getMonth() + 1) : ("0" + (currentdate.getMonth() + 1))) + "/"
        + (currentdate.getFullYear()) + " @ "
        + ((currentdate.getHours() > 9) ? (currentdate.getHours()) : ("0" + currentdate.getHours())) + ":"
        + ((currentdate.getMinutes() > 9) ? (currentdate.getMinutes()) : ("0" + currentdate.getMinutes())) + ":"
        + ((currentdate.getSeconds() > 9) ? (currentdate.getSeconds()) : ("0" + currentdate.getSeconds()));

    return datetime;
}

export function toDateTime(secs) {

    let date = new Date(1970, 0, 1); // Epoch
    date.setSeconds(secs);

    return date;
}

export function toDateFolder(timestamp) {

    const currentdate = toDateTime(timestamp);

    return (currentdate.getFullYear()) + "-" + ((currentdate.getMonth() > 8) ? (currentdate.getMonth() + 1) : ("0" + (currentdate.getMonth() + 1))) + "-" + ((currentdate.getDate() > 9) ? (currentdate.getDate()) : ("0" + currentdate.getDate()));
}