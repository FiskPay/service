export function isJson(_string) {

    try {
        JSON.parse(_string);
    } catch (e) {
        return false;
    }

    return true;
}